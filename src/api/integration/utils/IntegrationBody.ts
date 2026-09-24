import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export abstract class IntegrationBody<P, M, ParamOption = void> {
  @ApiProperty()
  messageType: string;

  @ApiProperty({ default: 1 })
  messageTypeVersion: number = 1;

  @ApiPropertyOptional()
  senderId: string = "";

  @ApiPropertyOptional()
  messageId: string = "";

  @ApiProperty({ type: Object })
  payload!: P;

  constructor(
    messageType: string,
    data?: Partial<IntegrationBody<P, M, ParamOption>>
  ) {
    this.messageType = messageType;
    if (data) Object.assign(this, data);
  }

  abstract transform(param: ParamOption): M;

  abstract revert(m: M): P;
}
