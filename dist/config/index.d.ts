export declare const config: Readonly<{
    port: string;
    proxmox: {
        endpoint: string;
        node: string;
        apiTokenId: string;
        apiTokenSecret: string;
        sslVerify: boolean;
        templateId: string;
        datastoreId: string;
    };
    pulumi: {
        sshUsername: string;
        sshPrivateKey: string;
    };
    log: string | undefined;
    env: string | undefined;
}>;
//# sourceMappingURL=index.d.ts.map