import { FastifyPluginAsync } from "fastify";
import { prisma } from "../prisma.js";

const customerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/:phone", async (request) => {
    const { phone } = request.params as { phone: string };

    let customer = await prisma.customer.findUnique({
      where: { phone },
      include: {
        addresses: true,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          phone,
        },
        include: {
          addresses: true,
        },
      });
    }

    return customer;
  });
};

export default customerRoutes;