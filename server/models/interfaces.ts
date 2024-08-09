export interface Component {
    id?: number
    snComponent: string
    pnComponentId: string
    supplier: string
    invoice: string
    status: string
    comment: string
    createdAt?: Date | string
    updatedAt?: Date | string
    user: string
    snProductId: string
}

export interface Operator {
    login: string;
    status: string;
}

export interface ProductionOperation {
    stageType: string;
    status: string;
    operatorId: number;
    productId: number;
}

export interface Product {
    snProduct: string;
    operationId: number;
    specificationId: number;
    templateId: number;
    testId: number;
}

export interface Specification {
    version: number;
    productName: string;
    productMP: string;
    productMC: string;
    productMM: string;
    ElectronicBoard1: string;
    ElectronicBoard2: string;
    ElectronicBoard3: string;
    ElectronicBoard4: string;
    ElectronicBoard5: string;
    ElectronicBoard6: string;
    OtherCirciutry: string;
    EnclosureType: string;
    MountingScrew: string;
}

export interface Operation {
    version: number;
    productMC: string;
    issue: boolean;
    preProdaction: boolean;
    assembly: boolean;
    marking: boolean;
    functionalTest: boolean;
    verification: boolean;
    package: boolean;
}

export interface Template {
    version: number;
    productMC: string;
    markingTemplate: string;
    markingEquipment: string;
    stendForHiPot: string;
    stendForTest: string;
    verificationProtocol: string;
    RE: string;
    PS: string;
    boxLabel: string;
}

export interface Test {
    version: number;
    productMC: string;
    HiPot: string;
}

export interface PartNumberComponent {
    partNumber: string;
    descriptionRU: string;
    descriptionEN: string;
}