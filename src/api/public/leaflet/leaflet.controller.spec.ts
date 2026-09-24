import { Test, TestingModule } from '@nestjs/testing';
import { LeafletController } from './leaflet.controller';

describe('LeafletController', () => {
  let controller: LeafletController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeafletController],
    }).compile();

    controller = module.get<LeafletController>(LeafletController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
