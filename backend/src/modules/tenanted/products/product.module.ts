import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { ProductController } from './product.controller';
import { ProductRepository } from './product.repository';
import { ProductService } from './product.service';

@Module({
  imports: [RbacModule],
  controllers: [ProductController],
  providers: [ProductRepository, ProductService],
})
export class ProductModule {}
