import { Body, Controller, Post, UseInterceptors } from "@nestjs/common";
import { ApiProperty, ApiTags } from "@nestjs/swagger";
import { Environment } from "../../utils/environment";
import { ConditionalRoute } from "../../utils/decorators";
import { BackendModes } from "../../utils/constants";
import { TokenInterceptor } from "../../interceptors/token.interceptor";
import { OrganizationInfrastructureService } from "@bagacito/lavajet-toolkit";
import { Service } from "@decaf-ts/core";
import { Public } from "@decaf-ts/for-nest";

class OnboardDto {
  @ApiProperty({ example: "some-token" })
  token!: string;

  @ApiProperty({ example: "Mah2MSP" })
  mspId!: string;
}

class ContractDto extends OnboardDto {
  @ApiProperty({ example: "lavajet-chaincode" })
  contract!: string;
  @ApiProperty({ example: "lavajet-channel" })
  channel!: string;
  @ApiProperty({ example: true })
  update!: boolean;
  @ApiProperty({ example: true })
  onPrem!: boolean;
}

@Controller("infrastructure")
@ApiTags("InfrastructureManagement")
export class InfrastructureController {
  private service: OrganizationInfrastructureService;

  constructor() {
    this.service = Service.get(OrganizationInfrastructureService as any);
  }

  @ConditionalRoute(Environment.mode === BackendModes.BOOT)
  @Post("join-channel")
  @Public()
  @UseInterceptors(TokenInterceptor)
  async joinChannel(@Body() body: OnboardDto) {
    await this.service.joinChannel(body.token);
    return { message: "Organization is Joining the channels" };
  }

  @Post("deploy-contract")
  @Public()
  @UseInterceptors(TokenInterceptor)
  async deployContract(@Body() body: ContractDto) {
    if (
      Environment.mode !== BackendModes.BOOT &&
      Environment.automaticContractUpdate === false
    ) {
      return {
        message: "Organization doesn't allow for automatic contract update",
      };
    }

    const contractPort = body.onPrem
      ? Environment.onPremContractPort
      : Environment.epiContractPort;

    await this.service.deployContract(
      body.token,
      body.channel || "",
      body.contract,
      contractPort,
      body.update,
      body.onPrem
    );
    return {
      message: `Organization ${body.update || false ? "updating" : "deploying"} contract`,
    };
  }
}
