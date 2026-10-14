ALTER TABLE "orders" ADD COLUMN "shipping_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_line1" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_line2" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_city" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_state" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_postal_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_country" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfillment_status" text DEFAULT 'unfulfilled' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_fulfillment_status_check" CHECK ("orders"."fulfillment_status" in ('unfulfilled', 'shipped', 'delivered', 'cancelled'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipped_at_check" CHECK ("orders"."fulfillment_status" not in ('shipped', 'delivered') or "orders"."shipped_at" is not null);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivered_at_check" CHECK ("orders"."fulfillment_status" <> 'delivered' or "orders"."delivered_at" is not null);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_refunded_cents_check" CHECK ("orders"."refunded_cents" >= 0 and "orders"."refunded_cents" <= "orders"."total_cents");