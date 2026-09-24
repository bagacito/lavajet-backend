import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseInterceptors,
  StreamableFile,
  Header,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiProperty, ApiTags } from "@nestjs/swagger";
import { Public, Service } from "@decaf-ts/for-nest";
import {
  AccountService,
  InfrastructureService,
  normalizeNameFromMSP,
} from "@bagacito/lavajet-toolkit/admin";
import { Account } from "@bagacito/lavajet-toolkit";
import { Auth } from "@decaf-ts/for-nest";
import { TokenInterceptor } from "../../interceptors/token.interceptor";
import { join } from "path";
import { createReadStream, existsSync } from "fs";
import { ServerStateInterceptor } from "../../interceptors/server-state.interceptor";
import { BackendModes } from "../../utils/constants";

class BufferJsonDto {
  @ApiProperty({ example: "Buffer" })
  type!: string;

  @ApiProperty({
    type: [Number],
    example: [31, 139, 8],
  })
  data!: number[];
}

class AccountDTO {
  @ApiProperty({ example: "some-token" })
  token!: string;

  @ApiProperty({ example: "Mah2MSP" })
  mspId!: string;
}

class DeployDto extends AccountDTO {
  @ApiProperty({ example: true })
  skipDeploy!: boolean;
}

class OnboardDto extends AccountDTO {
  @ApiProperty({ example: "mah2-peer-0" })
  peerHost!: string;

  @ApiProperty({ example: 7000 })
  peerPort!: number;

  @ApiProperty({ type: BufferJsonDto })
  mspDir!: BufferJsonDto;
}

@Controller("infrastructure")
@ApiTags("InfrastructureManagement")
export class InfrastructurePLAController {
  constructor(
    @Service() private readonly service: InfrastructureService,
    @Service(Account) private readonly accountService: AccountService
  ) {}

  @Post("update-contract-images")
  @Auth(Account)
  @ApiOperation({
    summary: `Update contract images for Pharmaledger managed accounts.`,
  })
  async updateContractImages(@Req() req: Request) {
    await this.accountService.updateContractImage();
    return { message: "Contract images update tasks successfully" };
  }

  @Post("update-contracts")
  @Auth(Account)
  @ApiOperation({
    summary: `Update contracts for Pharmaledger managed accounts.`,
  })
  async updateContracts(@Req() req: Request) {
    await this.accountService.updateContract();
    return { message: "Contracts update tasks created successfully" };
  }

  @Post("deploy/:orgName")
  @Auth(Account)
  @ApiOperation({
    summary: `Deploys pla managed organizations infrastructure or creates accounts for on prem.`,
  })
  @ApiParam({
    name: "orgName",
    required: true,
    description: "Organization name",
  })
  async deploy(@Param("orgName") orgName: string, @Req() req: Request) {
    return await this.accountService.deploy(orgName);
  }

  @Post("onboard-on-prem")
  @Public()
  @UseInterceptors(TokenInterceptor)
  async onboardOnPrem(@Body() body: OnboardDto) {
    const filename = `${body.mspId}.tar.gz`;
    await this.service.saveMspDir(filename, body.mspDir);

    const acc = await this.accountService.read(
      normalizeNameFromMSP(body.mspId)
    );

    await this.service.onPremJoinChannels(
      acc,
      body.token,
      body.peerHost,
      body.peerPort
    );

    return { message: "Onboarding tasks in progress" };
  }

  @Post("claim-on-prem")
  @Public()
  @UseInterceptors(TokenInterceptor)
  async claimOnPrem(@Body() body: DeployDto) {
    await this.accountService.finishOnPremDeployment(
      body.mspId,
      body.token,
      body.skipDeploy!
    );
    return { message: "Creating account config task created" };
  }

  @Post("deploy-on-prem-contracts")
  @UseInterceptors(TokenInterceptor)
  async deployOnPremContracts(@Body() body: DeployDto) {
    await this.accountService.deployOnPrem(
      body.mspId!,
      body.token!,
      body.skipDeploy!
    );

    return { message: "Deploying tasks in progress" };
  }

  @Get("download/certificates/:mspId/:token")
  @Public()
  @UseInterceptors(TokenInterceptor)
  @Header("Content-Type", "application/gzip")
  @Header("Content-Disposition", 'attachment; filename="certificates.tar.gz"')
  downloadLatestCertificates(
    @Param("token") token: string,
    @Param("mspId") mspId: string,
    @Res({ passthrough: true }) res: Response
  ): StreamableFile {
    const filename = `certificates.tar.gz`;
    const filePath = join("/docker/storage", filename);

    return new StreamableFile(createReadStream(filePath));
  }

  @Get("download/contract/:contractName/:mspId/:token")
  @UseInterceptors(TokenInterceptor)
  @Public()
  @Header("Content-Type", "application/gzip")
  @Header("Content-Disposition", 'attachment; filename="contract.tar.gz"')
  downloadLatestContracts(
    @Param("token") token: string,
    @Param("mspId") mspId: string,
    @Param("contractName") name: string,
    @Res({ passthrough: true }) res: Response
  ): StreamableFile {
    const filename = `${name}.tar.gz`;
    const filePath = join(`/docker/contract/${name}`, filename);

    return new StreamableFile(createReadStream(filePath));
  }

  @Get("download/:mspId/:token")
  @Public()
  @UseInterceptors(TokenInterceptor)
  @Header("Content-Type", "application/gzip")
  @Header("Content-Disposition", 'attachment; filename="mspdir.tar.gz"')
  downloadLatest(
    @Param("token") token: string,
    @Param("mspId") mspId: string,
    @Res({ passthrough: true }) res: Response
  ): StreamableFile {
    const filename = `${mspId}.tar.gz`;
    const filePath = join("/docker/storage", filename);

    return new StreamableFile(createReadStream(filePath));
  }

  @Post("generate-certificates")
  @Public()
  @UseInterceptors(new ServerStateInterceptor(BackendModes.MAINTENANCE))
  async generateCertificates() {
    await this.service.generateCertificates();
    return { message: "Running task to generate tls certificates tar.gz" };
  }
}
