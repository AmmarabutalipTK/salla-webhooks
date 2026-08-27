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
  cart?: unknown;
  coupon_code?: string | null;
};

const orderRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: CreateSallaOrderBody }>(
    "/api/salla/orders",
    async (req, res) => {
      try {
        // -----------------------------------------
        // Authorization
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
        // Parse cart from Engati
        // -----------------------------------------

        const parseCart = (value: unknown): CartItem[] | null => {
          // Already an array
          if (Array.isArray(value)) {
            return value as CartItem[];
          }

          // Nothing received
          if (value === null || value === undefined) {
            return null;
          }

          // JSON string
          if (typeof value === "string") {
            const trimmed = value.trim();

            if (!trimmed) {
              return null;
            }

            try {
              const parsed = JSON.parse(trimmed);

              return parseCart(parsed);
            } catch {
              return null;
            }
          }

          // Object
          if (typeof value === "object") {
            const obj = value as Record<string, unknown>;

            // { cart: [...] }
            if (obj.cart !== undefined) {
              return parseCart(obj.cart);
            }

            // { data: [...] }
            if (obj.data !== undefined) {
              return parseCart(obj.data);
            }

            // { Response: { data: [...] } }
            if (obj.Response !== undefined) {
              return parseCart(obj.Response);
            }

            // { products: [...] }
            if (obj.products !== undefined) {
              return parseCart(obj.products);
            }
          }

          return null;
        };

        const parsedCart = parseCart(cart);

        // -----------------------------------------
        // Validate cart
        // -----------------------------------------

        if (!parsedCart) {
          console.error(
            "Unable to parse cart:",
            JSON.stringify(cart, null, 2)
          );

          return res.status(400).send({
            success: false,
            message: "Unable to parse cart",
          });
        }

        if (parsedCart.length === 0) {
          return res.status(400).send({
            success: false,
            message: "cart cannot be empty",
          });
        }

        // -----------------------------------------
        // Convert cart → Salla products
        // -----------------------------------------

        const products = parsedCart.map((item, index) => {
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
        // Build Salla order
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
        // Coupon
        // -----------------------------------------

        if (
          typeof coupon_code === "string" &&
          coupon_code.trim().length > 0
        ) {
          orderPayload.coupon_code = coupon_code.trim();
        }

        // -----------------------------------------
        // Log
        // -----------------------------------------

        console.log("========================================");
        console.log("SALLA ORDER PAYLOAD");
        console.log(
          JSON.stringify(orderPayload, null, 2)
        );
        console.log("========================================");

        // -----------------------------------------
        // Send to Salla
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

        console.log("========================================");
        console.log("SALLA STATUS:", response.status);
        console.log(
          "SALLA RESPONSE:",
          typeof data === "string"
            ? data
            : JSON.stringify(data, null, 2)
        );
        console.log("========================================");

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