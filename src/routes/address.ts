import { FastifyPluginAsync } from "fastify";
import { prisma } from "../prisma.js";

const addressRoutes: FastifyPluginAsync = async (app) => {
  app.get("/:phone", async (request) => {
    const { phone } = request.params as {
      phone: string;
    };

    const customer = await prisma.customer.findUnique({
      where: {
        phone,
      },
      include: {
        addresses: true,
      },
    });

    return customer?.addresses ?? [];
  });
};

export default addressRoutes;