import { Request, Response } from 'express';
import { v4 as uuidv4, validate } from 'uuid';
import { Key } from '~/common/enums/keys.enum';

export const RequestIdMiddleware = (req: Request, res: Response, next: () => void): void => {
  // set request id, if not being set yet
  if (!req.headers[Key.RequestIdTokenHeader] || !validate(req.header(Key.RequestIdTokenHeader))) {
    req.headers[Key.RequestIdTokenHeader] = uuidv4();
  }
  // set res id in response from req
  res.set(Key.RequestIdTokenHeader, req.headers[Key.RequestIdTokenHeader]);
  next();
};