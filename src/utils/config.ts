import {ConfigService as Conf} from "@nestjs/config";
import {Environment} from "./environment";
import {Injectable} from "@nestjs/common";

@Injectable()
export class ConfigService extends Conf {
    constructor() {
        super(Environment);
    }
}