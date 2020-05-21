/* Generated by ts-generator ver. 0.0.8 */
/* tslint:disable */

import {Contract, ContractTransaction, EventFilter, Signer} from "ethers";
import {Listener, Provider} from "ethers/providers";
import {Arrayish, BigNumber, BigNumberish, Interface} from "ethers/utils";
import {TransactionOverrides, TypedEventDescription, TypedFunctionDescription} from ".";

interface PProxyInterface extends Interface {
  functions: {
    addressToBytes32: TypedFunctionDescription<{
      encode([_value]: [string]): string;
    }>;

    bytes32ToAddress: TypedFunctionDescription<{
      encode([_value]: [Arrayish]): string;
    }>;

    bytes32ToString: TypedFunctionDescription<{
      encode([_value]: [Arrayish]): string;
    }>;

    getImplementation: TypedFunctionDescription<{encode([]: []): string}>;

    getProxyOwner: TypedFunctionDescription<{encode([]: []): string}>;

    readAddress: TypedFunctionDescription<{
      encode([_key]: [Arrayish]): string;
    }>;

    readBool: TypedFunctionDescription<{encode([_key]: [Arrayish]): string}>;

    readString: TypedFunctionDescription<{
      encode([_key]: [Arrayish]): string;
    }>;

    setImplementation: TypedFunctionDescription<{
      encode([_newImplementation]: [string]): string;
    }>;

    setProxyOwner: TypedFunctionDescription<{
      encode([_newOwner]: [string]): string;
    }>;

    storageRead: TypedFunctionDescription<{
      encode([_key]: [Arrayish]): string;
    }>;

    stringToBytes32: TypedFunctionDescription<{
      encode([_value]: [string]): string;
    }>;
  };

  events: {};
}

export class PProxy extends Contract {
  connect(signerOrProvider: Signer | Provider | string): PProxy;
  attach(addressOrName: string): PProxy;
  deployed(): Promise<PProxy>;

  on(event: EventFilter | string, listener: Listener): PProxy;
  once(event: EventFilter | string, listener: Listener): PProxy;
  addListener(eventName: EventFilter | string, listener: Listener): PProxy;
  removeAllListeners(eventName: EventFilter | string): PProxy;
  removeListener(eventName: any, listener: Listener): PProxy;

  interface: PProxyInterface;

  functions: {
    addressToBytes32(_value: string): Promise<string>;

    bytes32ToAddress(_value: Arrayish): Promise<string>;

    bytes32ToString(_value: Arrayish): Promise<string>;

    getImplementation(): Promise<string>;

    getProxyOwner(): Promise<string>;

    readAddress(_key: Arrayish): Promise<string>;

    readBool(_key: Arrayish): Promise<boolean>;

    readString(_key: Arrayish): Promise<string>;

    setImplementation(
      _newImplementation: string,
      overrides?: TransactionOverrides
    ): Promise<ContractTransaction>;

    setProxyOwner(
      _newOwner: string,
      overrides?: TransactionOverrides
    ): Promise<ContractTransaction>;

    storageRead(_key: Arrayish): Promise<string>;

    stringToBytes32(_value: string): Promise<string>;
  };

  addressToBytes32(_value: string): Promise<string>;

  bytes32ToAddress(_value: Arrayish): Promise<string>;

  bytes32ToString(_value: Arrayish): Promise<string>;

  getImplementation(): Promise<string>;

  getProxyOwner(): Promise<string>;

  readAddress(_key: Arrayish): Promise<string>;

  readBool(_key: Arrayish): Promise<boolean>;

  readString(_key: Arrayish): Promise<string>;

  setImplementation(
    _newImplementation: string,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;

  setProxyOwner(_newOwner: string, overrides?: TransactionOverrides): Promise<ContractTransaction>;

  storageRead(_key: Arrayish): Promise<string>;

  stringToBytes32(_value: string): Promise<string>;

  filters: {};

  estimate: {
    addressToBytes32(_value: string): Promise<BigNumber>;

    bytes32ToAddress(_value: Arrayish): Promise<BigNumber>;

    bytes32ToString(_value: Arrayish): Promise<BigNumber>;

    getImplementation(): Promise<BigNumber>;

    getProxyOwner(): Promise<BigNumber>;

    readAddress(_key: Arrayish): Promise<BigNumber>;

    readBool(_key: Arrayish): Promise<BigNumber>;

    readString(_key: Arrayish): Promise<BigNumber>;

    setImplementation(_newImplementation: string): Promise<BigNumber>;

    setProxyOwner(_newOwner: string): Promise<BigNumber>;

    storageRead(_key: Arrayish): Promise<BigNumber>;

    stringToBytes32(_value: string): Promise<BigNumber>;
  };
}
