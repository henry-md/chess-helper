import { StoredUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      user?: StoredUser | null;
    }
  }
}
