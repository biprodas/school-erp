import { IsDefined, IsString } from 'class-validator';
import { IsSlug } from '~/shared/slug/reserved-slugs';

export class RenameSlugDto {
  @IsDefined()
  @IsString()
  @IsSlug()
  slug: string;
}
