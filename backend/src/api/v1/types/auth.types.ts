export interface RegisterDTO{
    email:string;
    password:string;
    role?:"CUSTOMER" | "DRIVER" | "ADMIN"
}



export interface LoginDTO{
    email:string;
    password:string;
}


