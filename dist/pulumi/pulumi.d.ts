import * as pulumi from '@pulumi/pulumi';
export type CreateVMRequest = {
    id: number;
    name: string;
    cpu: number;
    memory: number;
    storage: number;
    ioAddress: string;
    gateway: string;
    username: string;
    password: string;
    sshKey: string;
    templateId: string;
};
interface VmInfo {
    vmId: number;
    cpus: number;
    memory: number;
    name: string;
    status: string;
    uptime: string;
}
export declare const createVm: (vm: CreateVMRequest) => Promise<pulumi.automation.UpResult>;
export declare const destroyVm: (vm: string) => Promise<void>;
export declare const getVm: (vmId: string) => Promise<void>;
export declare function formatDuration(seconds: number): string;
export declare const listVms: () => Promise<VmInfo[]>;
export declare const getVmState: (vmId: string) => Promise<{
    output: {
        vmId: any;
        cpus: any;
        memory: any;
        name: any;
        status: any;
        uptime: string;
    };
}>;
export declare const createOrSelectStack: (vmId: string) => Promise<pulumi.automation.Stack>;
export {};
//# sourceMappingURL=pulumi.d.ts.map