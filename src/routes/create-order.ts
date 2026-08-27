import { FastifyPluginAsync } from "fastify";

type CartItem = {
  product_retailer_id: string | number;
  quantity: string | number;
};

type CreateSallaOrderBody = {
  customer: unknown;
  receiver: unknown;
  delivery_method: string;
  courier_id: number | string;
  ship_to: unknown;
  payment: unknown;
  cart: CartItem[];
  coupon_code?: string | null;
};

const orderRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: CreateSallaOrderBody }>(
    "/api/salla/orders",
    async (req, res) => {
      try {
        // -----------------------------------------
        // Get Authorization header from Engati
        // -----------------------------------------

        const authorization = req.headers.authorization;

        if (!authorization) {
          return res.status(401).send({
            success: false,
            message: "Authorization header is required",
          });
        }

        if (!authorization.startsWith("Bearer ")) {
          return res.status(401).send({
            success: false,
            message: "Authorization must use Bearer token",
          });
        }

        // -----------------------------------------
        // Request body
        // -----------------------------------------

        const {
          customer,
          receiver,
          delivery_method,
          courier_id,
          ship_to,
          payment,
          cart,
          coupon_code,
        } = req.body;

        // -----------------------------------------
        // Validate cart
        // -----------------------------------------

        if (!Array.isArray(cart)) {
          return res.status(400).send({
            success: false,
            message: "cart must be an array",
          });
        }

        if (cart.length === 0) {
          return res.status(400).send({
            success: false,
            message: "cart cannot be empty",
          });
        }

        // -----------------------------------------
        // Convert Engati cart → Salla products
        // -----------------------------------------

        const products = cart.map((item, index) => {
          const identifier = Number(item.product_retailer_id);
          const quantity = Number(item.quantity);

          if (!Number.isFinite(identifier)) {
            throw new Error(
              `Invalid product_retailer_id at cart index ${index}`
            );
          }

          if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error(
              `Invalid quantity at cart index ${index}`
            );
          }

          return {
            identifier_type: "id",
            identifier,
            quantity,
          };
        });

        // -----------------------------------------
        // Build Salla order payload
        // -----------------------------------------

        const orderPayload: Record<string, unknown> = {
          customer,
          receiver,
          delivery_method,
          courier_id: Number(courier_id),
          ship_to,
          payment,
          products,
        };

        // -----------------------------------------
        // Add coupon if provided
        // -----------------------------------------

        if (
          typeof coupon_code === "string" &&
          coupon_code.trim().length > 0
        ) {
          orderPayload.coupon_code = coupon_code.trim();
        }

        // -----------------------------------------
        // Log order
        // -----------------------------------------

        console.log(
          "========================================"
        );

        console.log("Creating Salla order:");

        console.log(
          JSON.stringify(orderPayload, null, 2)
        );

        console.log(
          "========================================"
        );

        // -----------------------------------------
        // Send request to Salla
        // -----------------------------------------

        const response = await fetch(
          "https://api.salla.dev/admin/v2/orders",
          {
            method: "POST",

            headers: {
              Authorization: authorization,
              Accept: "application/json",
              "Content-Type": "application/json",
            },

            body: JSON.stringify(orderPayload),
          }
        );

        // -----------------------------------------
        // Read Salla response
        // -----------------------------------------

        const responseText = await response.text();

        let data: unknown;

        try {
          data = JSON.parse(responseText);
        } catch {
          data = responseText;
        }

        // -----------------------------------------
        // Log Salla response
        // -----------------------------------------

        console.log(
          "========================================"
        );

        console.log(
          "Salla status:",
          response.status
        );

        console.log(
          "Salla response:",
          typeof data === "string"
            ? data
            : JSON.stringify(data, null, 2)
        );

        console.log(
          "========================================"
        );

        // -----------------------------------------
        // Return Salla response to Engati
        // -----------------------------------------

        return res
          .status(response.status)
          .send(data);

      } catch (error) {
        console.error(
          "Create Salla order error:",
          error
        );

        return res.status(500).send({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Unknown error",
        });
      }
    }
  );
};

export default orderRoutes;