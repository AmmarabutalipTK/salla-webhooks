import { FastifyPluginAsync } from "fastify";
import { prisma } from "../prisma.js";

const addressRoutes: FastifyPluginAsync = async (app) => {
  // Get all addresses for a customer
  app.get("/:phone", async (request) => {
    const { phone } = request.params as { phone: string };

    const customer = await prisma.customer.findUnique({
      where: { phone },
      include: {
        addresses: true,
      },
    });

    return customer?.addresses ?? [];
  });

  // Create address
  app.post("/:phone", async (request) => {
    const { phone } = request.params as { phone: string };

    const body = request.body as {
      name: string;
      city?: string;
      district?: string;
      street?: string;
      latitude?: number;
      longitude?: number;
    };

    const customer = await prisma.customer.upsert({
      where: { phone },
      update: {},
      create: {
        phone,
      },
    });

    return prisma.address.create({
      data: {
        customerId: customer.id,
        ...body,
      },
    });
  });

  // Update address
  app.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const body = request.body as {
      name?: string;
      city?: string;
      district?: string;
      street?: string;
      latitude?: number;
      longitude?: number;
      isDefault?: boolean;
    };

    const address = await prisma.address.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!address) {
      return reply.code(404).send({
        message: "Address not found",
      });
    }

    return prisma.address.update({
      where: {
        id: Number(id),
      },
      data: body,
    });
  });

  // Delete address
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const address = await prisma.address.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!address) {
      return reply.code(404).send({
        message: "Address not found",
      });
    }

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