import { StatusCodes } from "http-status-codes";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { logger } from "@/server";
import { ICreateCustomerSchema, ICustomer, IDiscountedDish, IFindRestuarantSchema } from "./botModel";
import prisma from "@/database/prisma";

export class BotService {
  private readonly MAX_DISTANCE_KM = 5;
  private readonly MAX_RESULTS = 10;

  async createCustomer(data: { telegramId: string }): Promise<ServiceResponse<ICustomer | null>> {
    try {

      const customer = await prisma.customer.create({
        data: {
          telegramId: data.telegramId
        },
      });

      logger.info("New customer created with telegram ID: " + data.telegramId);
      return ServiceResponse.success("Created successfully", customer as any , 201);
    } catch (error) {
      console.log({ error });
      logger.error("Error creating customer:", error);
      return ServiceResponse.failure("Error creating customer", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async findNearByResutuarants(data: IFindRestuarantSchema): Promise<ServiceResponse<IDiscountedDish[] | null>> {
    try {
      const { latitude, longitude } = data;
      const currentTime = new Date();

      const nearbyDiscounts = await prisma.discount.findMany({
        include: {
          branch: {
            include: {
              restaurant: true,
            },
          },
        },
        where: {
          isActive: true,
          startTime: {
            lte: currentTime,
          },
          endTime: {
            gt: currentTime,
          },
          quantity: {
            gt: 0,
          },
        },
      });

      if (!nearbyDiscounts.length) {
        logger.info("No nearby restaurants with active discounts found");
        return ServiceResponse.failure(
          "No discounts available in your area",
          null,
          StatusCodes.NOT_FOUND
        );
      }

      const discountedDishes: IDiscountedDish[] = nearbyDiscounts.map((discount) => ({
        restaurantName: discount.branch.restaurant.name,
        branchAddress: discount.branch.address,
        branchDescription: discount.branch.description,
        distanceKm: 0, // Note: You'll need to implement distance calculation
        dishName: discount.dishName,
        dishImage: discount.dishImage,
        description: discount.description,
        discountCode: discount.code,
        currency: discount.currency,
        originalPrice: discount.originalPrice,
        discountPrice: discount.discountPrice,
        quantity: discount.quantity,
        validUntil: discount.endTime,
        isActive: discount.isActive,
      }));

      logger.info(`Found ${discountedDishes.length} active discounts in nearby restaurants`);
      return ServiceResponse.success("Nearby discounts found", discountedDishes, StatusCodes.OK);
    } catch (error) {
      logger.error("Error finding nearby restaurants:", error);
      return ServiceResponse.failure("Internal server error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async reedemCode(discountCode: string, customerId: string): Promise<ServiceResponse<IDiscountedDish | null>> {
    try {
      const currentDate = new Date();

      // Check if customer has already used this discount
      const existingRedemption = await prisma.discount.findFirst({
        where: {
          code: discountCode,
          customer: {
            some: {
              id: customerId,
            },
          },
        },
      });

      if (existingRedemption) {
        return ServiceResponse.failure(
          "You have already redeemed this discount code",
          null,
          StatusCodes.BAD_REQUEST
        );
      }

      // Get discount with related information
      const discount = await prisma.discount.findFirst({
        where: {
          code: discountCode,
          isActive: true,
          endTime: {
            gt: currentDate,
          },
          startTime: {
            lte: currentDate,
          },
          quantity: {
            gt: 0,
          },
        },
        include: {
          branch: {
            include: {
              restaurant: true,
            },
          },
        },
      });

      if (!discount) {
        return ServiceResponse.failure(
          "This discount code is invalid or has expired",
          null,
          StatusCodes.NOT_FOUND
        );
      }

      // Use transaction to update discount and create relationship
      await prisma.$transaction(async (prismaClient) => {
        // Update discount
        await prismaClient.discount.update({
          where: {
            id: discount.id,
          },
          data: {
            quantity: {
              decrement: 1,
            },
            customerCount: {
              increment: 1,
            },
            updatedAt: currentDate,
            customer: {
              connect: {
                id: customerId,
              },
            },
          },
        });

        // Update customer
        await prismaClient.customer.update({
          where: {
            id: customerId,
          },
          data: {
            lastActive: currentDate,
            updatedAt: currentDate,
          },
        });
      });

      const discountedDish: IDiscountedDish = {
        restaurantName: discount.branch.restaurant.name,
        branchAddress: discount.branch.address,
        branchDescription: discount.branch.description,
        dishName: discount.dishName,
        dishImage: discount.dishImage,
        description: discount.description,
        discountCode: discount.code,
        currency: discount.currency,
        originalPrice: discount.originalPrice,
        discountPrice: discount.discountPrice,
        quantity: discount.quantity - 1,
        validUntil: discount.endTime,
        isActive: discount.isActive,
        redemptionDate: currentDate,
      };

      logger.info(`Discount code ${discountCode} successfully redeemed by customer ${customerId}`);

      return ServiceResponse.success(
        "Discount successfully redeemed! Show this to the restaurant staff.",
        discountedDish,
        StatusCodes.OK
      );
    } catch (error) {
      logger.error(`Error redeeming discount code ${discountCode} for customer ${customerId}:`, error);
      return ServiceResponse.failure(
        "An error occurred while redeeming the discount code",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
}

export const botService = new BotService();