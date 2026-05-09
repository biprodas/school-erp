import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(@Query() filterUserDto: FilterUserDto) {
    const users = await this.userService.findFiltered(filterUserDto);

    return {
      success: true,
      statusCode: 200,
      message: 'List of users',
      data: users,
    };
  }

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);

    return {
      success: true,
      statusCode: 201,
      message: `User created. ID: ${user.id}`,
      data: user,
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.userService.findById(id);

    return {
      success: true,
      statusCode: 200,
      message: `User found. ID: ${user.id}`,
      data: user,
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.userService.update(id, updateUserDto);

    return {
      success: true,
      statusCode: 200,
      message: `User updated. ID: ${user.id}`,
      data: user,
    };
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.userService.remove(id);

    return {
      success: true,
      statusCode: 200,
      message: `User deleted. ID: ${id}`,
    };
  }
}
