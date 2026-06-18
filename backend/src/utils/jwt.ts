//import jwt library

import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET as string;

export const generateToken = (user: { id: string; role: string; tenantId: string }) => {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};