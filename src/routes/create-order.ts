import { FastifyPluginAsync } from "fastify";

type SallaProduct = {
  identifier_type: "id";
  identifier: string | number;
  quantity: string | number;
};

type CreateSallaOrderBody = {
  customer: unknown;
  receiver: unknown;
  delivery_method: string;
  courier_id: number | string;
  ship_to: unknown;
  payment: unknown;
  products: SallaProduct[] | string;
  coupon_code?: string | null;
};

const orderRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: CreateSallaOrderBody }>(
    "/api/salla/orders",
    async (req, res) => {
      try {
        // =========================================
        // Authorization
        // =========================================

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

        // =========================================
        // Request body
        // =========================================

        const {
          customer,
          receiver,
          delivery_method,
          courier_id,
          ship_to,
          payment,
          products,
          coupon_code,
        } = req.body;

        // =========================================
        // Parse products
        // =========================================

        let parsedProducts: SallaProduct[];

        if (Array.isArray(products)) {
          parsedProducts = products;
        } else if (typeof products === "string") {
          try {
            parsedProducts = JSON.parse(products);
          } catch {
            return res.status(400).send({
              success: false,
              message: "products contains invalid JSON",
            });
          }
        } else {
          return res.status(400).send({
            success: false,
            message: "products must be an array or JSON string",
          });
        }

        // =========================================
        // Validate products
        // =========================================

        if (!Array.isArray(parsedProducts)) {
          return res.status(400).send({
            success: false,
            message: "products must contain an array",
          });
        }

        if (parsedProducts.length === 0) {
          return res.status(400).send({
            success: false,
            message: "products cannot be empty",
          });
        }

        // =========================================
        // Normalize products
        // =========================================

        const normalizedProducts = parsedProducts.map(
          (item, index) => {
            const identifier = Number(item.identifier);
            const quantity = Number(item.quantity);

            if (!Number.isFinite(identifier)) {
              throw new Error(
                `Invalid identifier at products index ${index}`
              );
            }

            if (!Number.isFinite(quantity) || quantity <= 0) {
              throw new Error(
                `Invalid quantity at products index ${index}`
              );
            }

            return {
              identifier_type: "id" as const,
              identifier,
              quantity,
            };
          }
        );

        // =========================================
        // Build Salla order payload
        // =========================================

        const orderPayload: Record<string, unknown> = {
          customer,
          receiver,
          delivery_method,
          courier_id: Number(courier_id),
          ship_to,
          payment,
          products: normalizedProducts,
        };

        // =========================================
        // Add coupon ONLY if not empty
        // =========================================

        if (
          typeof coupon_code === "string" &&
          coupon_code.trim() !== ""
        ) {
          orderPayload.coupon_code = coupon_code.trim();
        }

        // =========================================
        // Log final Salla payload
        // =========================================

        console.log("========================================");
        console.log("CREATING SALLA ORDER");
        console.log("========================================");

        console.log(
          JSON.stringify(orderPayload, null, 2)
        );

        console.log("========================================");

        // =========================================
        // Send request to Salla
        // =========================================

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

        // =========================================
        // Read Salla response
        // =========================================

        const responseText = await response.text();

        let data: unknown;

        try {
          data = JSON.parse(responseText);
        } catch {
          data = responseText;
        }

        // =========================================
        // Log Salla response
        // =========================================

        console.log("========================================");
        console.log("SALLA RESPONSE");
        console.log("Status:", response.status);

        console.log(
          "Data:",
          typeof data === "string"
            ? data
            : JSON.stringify(data, null, 2)
        );

        console.log("========================================");

        // =========================================
        // Return Salla response to Engati
        // =========================================

        return res
          .status(response.status)
          .send(data);
      } catch (error) {
        // =========================================
        // Error handling
        // =========================================

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