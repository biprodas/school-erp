import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return `<h2> Welcome to the School ERP API! </h2> <p> Please check /info for more information. </p>`;
  }

  getInfo() {
    return {
      version: '1.0.0',
      name: 'School ERP API',
      description: 'A School ERP API built with NestJS and TypeORM',
      architecture: 'Schema-per-tenant (Cost-effective)',
      stack: ['NestJS', 'TypeORM', 'PostgreSQL', 'TypeScript'],
      author: {
        name: 'Biprodas Roy',
        email: 'biprodas.cse@gmail.com',
      },
    };
  }
}
