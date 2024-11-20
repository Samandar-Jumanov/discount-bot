import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { commonValidations } from "@/common/utils/commonValidation";

extendZodWithOpenApi(z);

// main schemas 
export const customerSchema    = z.object({
  id  : z.string(),
  telegramId: z.string(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  discounts : z.array(z.any()),
  lastActive : z.string(),
  createdAt : z.date(),
  updatedAt : z.date()
});


export const branchSchema = z.object({})
export const restuarantSchema = z.object({})
export const discountedDishSchema = z.object({})



// action schemas 

export const createCustomerSchema   = z.object({
  telegramId: z.string(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});


export const findRestuarantsSchema = z.object({  
    latitude : z.string(),
    longitude : z.string()
})


export type ICreateCustomerSchema  = z.infer<typeof createCustomerSchema>;
export type IFindRestuarantSchema = z.infer<typeof findRestuarantsSchema>
export type ICustomer  = z.infer<typeof createCustomerSchema >
export type IBranch = z.infer< typeof branchSchema>
export type IRestuarant = z.infer< typeof restuarantSchema >
export type IDiscountedDish = z.infer<typeof discountedDishSchema>




