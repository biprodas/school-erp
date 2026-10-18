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
      architecture: 'Multi-tenant: shared schema with row-level security',
      stack: ['NestJS', 'TypeORM', 'PostgreSQL', 'TypeScript'],
      author: 'Biprodas Roy',
    };
  }
}
