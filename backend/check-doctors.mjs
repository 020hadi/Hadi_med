import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const doctors = await prisma.doctorProfile.findMany({
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
      schedules: true,
      specialties: true,
    },
  });

  console.log(JSON.stringify(doctors, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
