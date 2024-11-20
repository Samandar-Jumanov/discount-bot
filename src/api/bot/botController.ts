import type { Request, RequestHandler, Response } from "express";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { botService } from "./botService";
import { ICreateCustomerSchema } from "./botModel";

class BotController {

  public createCustomer: RequestHandler = async (req: Request, res: Response) => {

    const body  : ICreateCustomerSchema = await req.body
    const serviceResponse = await botService.createCustomer(body);
    return handleServiceResponse(serviceResponse, res);

  };

  public getRestuarants: RequestHandler = async (req: Request, res: Response) => {
    const body  = await req.body
    const serviceResponse = await botService.findNearByResutuarants(body);
    return handleServiceResponse(serviceResponse, res);
  };

  public reedemCode: RequestHandler = async (req: Request, res: Response) => {
    const body  = await req.body
    const customerId = req.params.customer
    const serviceResponse = await botService.reedemCode(body ,  String(customerId));
    return handleServiceResponse(serviceResponse, res);
  };


}

export const botController = new BotController();
