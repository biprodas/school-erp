import { DataSource, DataSourceOptions } from 'typeorm';

export const PUBLIC_SCHEMA = 'public';

export const publicDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  schema: PUBLIC_SCHEMA,
  entities: [__dirname + '/../modules/platform/**/entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/public/*{.ts,.js}'],
  synchronize: false,
};

const publicDataSource = new DataSource(publicDataSourceOptions);
export default publicDataSource;
