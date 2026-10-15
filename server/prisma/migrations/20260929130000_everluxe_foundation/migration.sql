-- AlterTable
UPDATE "User" SET "role" = 'CUSTOMER' WHERE "role" NOT IN ('ADMIN', 'CUSTOMER');
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "businessName" TEXT NOT NULL DEFAULT 'EVERLUXE EVENTS',
    "publicEmail" TEXT NOT NULL DEFAULT 'everluxeevents123@gmail.com',
    "phone" TEXT NOT NULL DEFAULT '+91 97452 27257',
    "whatsapp" TEXT NOT NULL DEFAULT '+91 97452 27257',
    "instagram" TEXT NOT NULL DEFAULT 'ever.luxe_events',
    "location" TEXT NOT NULL DEFAULT 'Nilambur, Malappuram, Kerala, India',
    "serviceArea" TEXT NOT NULL DEFAULT 'Across Kerala',
    "description" TEXT,
    "heroMode" TEXT NOT NULL DEFAULT 'DEFAULT',
    "heroImageUrl" TEXT,
    "logoUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogueCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignStyle" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignStyle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "imageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueDesign" (
    "id" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" INTEGER,
    "eventTypeId" INTEGER,
    "designStyleId" INTEGER,
    "price" DECIMAL(12,2),
    "priceType" TEXT NOT NULL DEFAULT 'ON_REQUEST',
    "priceVisibility" TEXT NOT NULL DEFAULT 'HIDDEN',
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogueDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueImage" (
    "id" SERIAL NOT NULL,
    "designId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogueImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPackage" (
    "id" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2),
    "priceType" TEXT NOT NULL DEFAULT 'ON_REQUEST',
    "priceVisibility" TEXT NOT NULL DEFAULT 'HIDDEN',
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "coverImageUrl" TEXT,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPackageItem" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "designId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryItem" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "imageUrl" TEXT NOT NULL,
    "eventTypeId" INTEGER,
    "designStyleId" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventEnquiry" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" INTEGER,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "eventTypeId" INTEGER,
    "eventDate" TIMESTAMP(3),
    "eventLocation" TEXT,
    "guestCount" INTEGER,
    "preferredStyle" TEXT,
    "budgetRange" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryDesign" (
    "id" SERIAL NOT NULL,
    "enquiryId" INTEGER NOT NULL,
    "designId" INTEGER NOT NULL,
    "designName" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "priceType" TEXT NOT NULL,
    "priceVisible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EnquiryDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryPackage" (
    "id" SERIAL NOT NULL,
    "enquiryId" INTEGER NOT NULL,
    "packageId" INTEGER NOT NULL,
    "packageName" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "priceType" TEXT NOT NULL,
    "priceVisible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EnquiryPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueCategory_name_key" ON "CatalogueCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueCategory_slug_key" ON "CatalogueCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DesignStyle_name_key" ON "DesignStyle"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DesignStyle_slug_key" ON "DesignStyle"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EventType_name_key" ON "EventType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EventType_slug_key" ON "EventType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueDesign_publicId_key" ON "CatalogueDesign"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueDesign_slug_key" ON "CatalogueDesign"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EventPackage_publicId_key" ON "EventPackage"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "EventPackage_slug_key" ON "EventPackage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EventPackageItem_packageId_designId_key" ON "EventPackageItem"("packageId", "designId");

-- CreateIndex
CREATE UNIQUE INDEX "EventEnquiry_reference_key" ON "EventEnquiry"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "EnquiryDesign_enquiryId_designId_key" ON "EnquiryDesign"("enquiryId", "designId");

-- CreateIndex
CREATE UNIQUE INDEX "EnquiryPackage_enquiryId_packageId_key" ON "EnquiryPackage"("enquiryId", "packageId");

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueDesign" ADD CONSTRAINT "CatalogueDesign_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogueCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueDesign" ADD CONSTRAINT "CatalogueDesign_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "EventType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueDesign" ADD CONSTRAINT "CatalogueDesign_designStyleId_fkey" FOREIGN KEY ("designStyleId") REFERENCES "DesignStyle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueDesign" ADD CONSTRAINT "CatalogueDesign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueDesign" ADD CONSTRAINT "CatalogueDesign_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueImage" ADD CONSTRAINT "CatalogueImage_designId_fkey" FOREIGN KEY ("designId") REFERENCES "CatalogueDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPackage" ADD CONSTRAINT "EventPackage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPackage" ADD CONSTRAINT "EventPackage_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPackageItem" ADD CONSTRAINT "EventPackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EventPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPackageItem" ADD CONSTRAINT "EventPackageItem_designId_fkey" FOREIGN KEY ("designId") REFERENCES "CatalogueDesign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventEnquiry" ADD CONSTRAINT "EventEnquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventEnquiry" ADD CONSTRAINT "EventEnquiry_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "EventType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryDesign" ADD CONSTRAINT "EnquiryDesign_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "EventEnquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryDesign" ADD CONSTRAINT "EnquiryDesign_designId_fkey" FOREIGN KEY ("designId") REFERENCES "CatalogueDesign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryPackage" ADD CONSTRAINT "EnquiryPackage_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "EventEnquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryPackage" ADD CONSTRAINT "EnquiryPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EventPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
