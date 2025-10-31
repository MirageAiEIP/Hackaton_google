-- CreateEnum
CREATE TYPE "AmbulanceStatus" AS ENUM ('AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'RETURNING', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "AmbulanceType" AS ENUM ('SMUR', 'AMBULANCE', 'VSAV', 'MEDICALISED');

-- AlterTable
ALTER TABLE "dispatches" ADD COLUMN     "ambulanceId" TEXT,
ADD COLUMN     "distanceKm" DOUBLE PRECISION,
ADD COLUMN     "estimatedArrivalMinutes" INTEGER;

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "totalAmbulances" INTEGER NOT NULL DEFAULT 0,
    "availableAmbulances" INTEGER NOT NULL DEFAULT 0,
    "hasSMUR" BOOLEAN NOT NULL DEFAULT false,
    "hasEmergencyRoom" BOOLEAN NOT NULL DEFAULT true,
    "hasHelicopterPad" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT NOT NULL,
    "emergencyContact" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulances" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "callSign" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "type" "AmbulanceType" NOT NULL,
    "hasDoctor" BOOLEAN NOT NULL DEFAULT false,
    "hasParamedic" BOOLEAN NOT NULL DEFAULT true,
    "hasAdvancedEquipment" BOOLEAN NOT NULL DEFAULT false,
    "status" "AmbulanceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentLatitude" DOUBLE PRECISION NOT NULL,
    "currentLongitude" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION DEFAULT 0,
    "speed" DOUBLE PRECISION DEFAULT 0,
    "homeHospitalId" TEXT NOT NULL,
    "currentDispatchId" TEXT,
    "crewSize" INTEGER NOT NULL DEFAULT 2,
    "crewNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "driverName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastServiceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambulances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulance_locations" (
    "id" TEXT NOT NULL,
    "ambulanceId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "status" "AmbulanceStatus" NOT NULL,
    "dispatchId" TEXT,
    "distanceToTarget" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambulance_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_code_key" ON "hospitals"("code");

-- CreateIndex
CREATE INDEX "hospitals_latitude_longitude_idx" ON "hospitals"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "hospitals_isActive_idx" ON "hospitals"("isActive");

-- CreateIndex
CREATE INDEX "hospitals_city_idx" ON "hospitals"("city");

-- CreateIndex
CREATE UNIQUE INDEX "ambulances_vehicleId_key" ON "ambulances"("vehicleId");

-- CreateIndex
CREATE INDEX "ambulances_status_idx" ON "ambulances"("status");

-- CreateIndex
CREATE INDEX "ambulances_homeHospitalId_idx" ON "ambulances"("homeHospitalId");

-- CreateIndex
CREATE INDEX "ambulances_currentLatitude_currentLongitude_idx" ON "ambulances"("currentLatitude", "currentLongitude");

-- CreateIndex
CREATE INDEX "ambulances_type_idx" ON "ambulances"("type");

-- CreateIndex
CREATE INDEX "ambulance_locations_ambulanceId_idx" ON "ambulance_locations"("ambulanceId");

-- CreateIndex
CREATE INDEX "ambulance_locations_recordedAt_idx" ON "ambulance_locations"("recordedAt");

-- CreateIndex
CREATE INDEX "ambulance_locations_dispatchId_idx" ON "ambulance_locations"("dispatchId");

-- CreateIndex
CREATE INDEX "calls_priority_idx" ON "calls"("priority");

-- CreateIndex
CREATE INDEX "dispatches_ambulanceId_idx" ON "dispatches"("ambulanceId");

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "ambulances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulances" ADD CONSTRAINT "ambulances_homeHospitalId_fkey" FOREIGN KEY ("homeHospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_locations" ADD CONSTRAINT "ambulance_locations_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "ambulances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
