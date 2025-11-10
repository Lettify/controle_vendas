CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "access_codes" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"company_id" varchar(64) NOT NULL,
	"created_by" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"used_by" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_reusable" boolean DEFAULT false NOT NULL,
	"description" text,
	"user_name" varchar(255),
	"user_email" varchar(320),
	"user_phone" varchar(20),
	CONSTRAINT "access_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "daily_sales" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"employee_id" varchar(64) NOT NULL,
	"company_id" varchar(64) NOT NULL,
	"date" varchar(10) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"company_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320),
	"phone" varchar(20),
	"position" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" text,
	"email" varchar(320),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_signed_in" timestamp with time zone DEFAULT now()
);
