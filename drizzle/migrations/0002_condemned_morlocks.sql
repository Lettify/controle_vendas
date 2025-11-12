CREATE TABLE "authorized_devices" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"access_code_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"device_name" varchar(255),
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "authorized_devices_access_code_id_idx" ON "authorized_devices" USING btree ("access_code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "authorized_devices_device_id_idx" ON "authorized_devices" USING btree ("device_id");