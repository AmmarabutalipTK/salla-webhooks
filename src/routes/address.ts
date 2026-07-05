import { FastifyPluginAsync } from "fastify";
import { prisma } from "../prisma.js";

const addressRoutes: FastifyPluginAsync = async (app) => {
  // Get addresses
  app.get("/:phone", async (request) => {
    const { phone } = request.params as { phone: string };

    const customer = await prisma.customer.findUnique({
      where: { phone },
      include: {
        addresses: true,
      },
    });

return [...(customer?.addresses?.slice(-3) ?? []), "اضافه عنوان"];
  });

  // Add address
  app.post("/:phone", async (request) => {
    const { phone } = request.params as { phone: string };

    const body = request.body as any;

    const customer = await prisma.customer.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    return prisma.address.create({
      data: {
        customerId: customer.id,
        ...body,
      },
    });
  });

  // Update address
  app.put("/:id", async (request) => {
    const { id } = request.params as { id: string };

    return prisma.address.update({
      where: {
        id: Number(id),
      },
      data: request.body as any,
    });
  });

  // Delete address
  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };

    await prisma.address.delete({
      where: {
        id: Number(id),
      },
    });

    return {
      success: true,
    };
  });
};

export default addressRoutes;