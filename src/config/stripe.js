import Stripe from "stripe";
import { AppError } from "../utils/errors.js";

let stripeClient;

export const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new AppError("Stripe payment service is not configured", 503);
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
};
