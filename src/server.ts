import Fastify from "fastify";
import dotenv from "dotenv";

import addressRoutes from "./routes/address.js";
import orderRoutes from "./routes/create-order.js";

dotenv.config();

const app = Fastify({
  logger: true,
});

app.register(addressRoutes, {
  prefix: "/address",
});

app.register(orderRoutes);

const start = async () => {
  try {
    await app.listen({
      port: Number(process.env.PORT ?? 3005),
      host: "0.0.0.0",
    });

    console.log(
      `🚀 Server running on port ${process.env.PORT ?? 3005}`
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();