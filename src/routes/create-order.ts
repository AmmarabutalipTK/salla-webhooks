import { FastifyPluginAsync } from "fastify";

type SallaProduct = {
  productId?: string | number;
  identifier_type?: "id";
  identifier?: string | number;
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
        // Variant mapping
        // =========================================

        const variants: Record<
          number,
          {
            parentId: number;
            optionId: number;
            optionValueId: number;
          }
        > = {
          259362436: {
            parentId: 288835721,
            optionId: 256735972,
            optionValueId: 183982973,
          },

          1498590597: {
            parentId: 288835721,
            optionId: 256735972,
            optionValueId: 1692170878,
          },

          923369965: {
            parentId: 122269710,
            optionId: 691503395,
            optionValueId: 1655204330,
          },

          14065902: {
            parentId: 122269710,
            optionId: 691503395,
            optionValueId: 1014401259,
          },
        };

        // =========================================
        // Normalize products
        // =========================================

        const normalizedProducts = parsedProducts.map(
          (item, index) => {
            /*
             * Prefer productId because this is the
             * variant ID from the cart.
             *
             * identifier is kept as fallback so the
             * endpoint remains compatible with the
             * previous request structure.
             */
            const productId = Number(
              item.productId ?? item.identifier
            );

            const quantity = Number(item.quantity);

            if (!Number.isFinite(productId)) {
              throw new Error(
                `Invalid productId at products index ${index}`
              );
            }

            if (!Number.isFinite(quantity) || quantity <= 0) {
              throw new Error(
                `Invalid quantity at products index ${index}`
              );
            }

            // =========================================
            // Check if product is a variant
            // =========================================

            const variant = variants[productId];

            if (variant) {
              return {
                identifier_type: "id" as const,
                identifier: variant.parentId,
                quantity,
                options: [
                  {
                    id: variant.optionId,
                    value: [String(variant.optionValueId)],
                  },
                ],
              };
            }

            // =========================================
            // Normal product
            // =========================================

            return {
              identifier_type: "id" as const,
              identifier: productId,
              quantity,
            };
          }
        );

        console.log(
          "NORMALIZED PRODUCTS:",
          JSON.stringify(normalizedProducts, null, 2)
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
        // Handle coupon
        // =========================================

        const coupon =
          typeof coupon_code === "string"
            ? coupon_code.trim()
            : "";

        if (
          coupon !== "" &&
          coupon.toUpperCase() !== "EMPTY"
        ) {
          orderPayload.coupon_code = coupon;
        }

        // =========================================
        // Log final payload
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
        // Return response to Engati
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