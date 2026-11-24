import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/validators.js';
import { MeDto } from '../../users/dto/me.dto.js';

/** Upper bound keeps argon2 work bounded for absurd inputs. */
const PASSWORD_MAX = 256;

export class RegisterDto {
  @ApiProperty({ example: 'Alex Moreno', maxLength: 100 })
  @Trim()
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ format: 'email', example: 'alex@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: PASSWORD_MAX, example: 'password123' })
  @IsString()
  @MinLength(8)
  @MaxLength(PASSWORD_MAX)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ format: 'email', example: 'alex@example.com' })
  @NormalizeEmail()
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX)
  password!: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: MeDto })
  user!: MeDto;

  @ApiPropertyOptional({
    description: 'Only for native clients (`X-Client: native`). Send as `Authorization: Bearer <token>`.',
  })
  token?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Only for native clients.' })
  expiresAt?: Date;
}
