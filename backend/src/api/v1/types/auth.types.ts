export interface RegisterDTO{
    email:string;
    password:string;
   // role?:"CUSTOMER" | "DRIVER" | "ADMIN"
   role?: "CUSTOMER" | "DRIVER" | "TENANT_SUB_ADMIN" | "TENANT_SUPER_ADMIN" | "PLATFORM_SUB_ADMIN" | "PLATFORM_SUPER_ADMIN";

}



export interface LoginDTO{
    email:string;
    password:string;
}


