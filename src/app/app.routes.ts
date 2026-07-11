import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { RegistrarUsuario } from './pages/registrar-usuario/registrar-usuario';
import { Login } from './pages/login/login';
import { Chofer } from './pages/chofer/chofer';
import { PasajeroComponent } from './pages/pasajero/pasajero';
import { AdminPage } from './pages/admin/admin';
import { BlogComponent } from './pages/blog.component/blog.component';
import { NosotrosComponent } from './pages/nosotros.component/nosotros.component';
import { PerfilComponent } from './pages/perfil.component/perfil.component';
import { authGuard } from './services/Interceptor/auth.guard';


export const routes: Routes = [
    { path: '', redirectTo: 'Home', pathMatch: 'full' },
    
    { path: 'Home', component: Home },
    
    { path: 'registro', component: RegistrarUsuario },

    {path: 'login', component: Login},

    // authGuard revisa que exista sesion y que el rol permita entrar a cada panel.
    {path: 'chofer', component: Chofer, canActivate: [authGuard], data: { roles: ['CHOFER','ADMIN'] }},

    {path: 'pasajero', component: PasajeroComponent, canActivate: [authGuard], data: { roles: ['PASAJERO','ADMIN'] }},

    {path: 'admin', component: AdminPage, canActivate: [authGuard], data: { roles: ['ADMIN'] }},
    
    {path: 'blogs', component: BlogComponent},

    {path: 'nosotros', component: NosotrosComponent},

    {path: 'perfil', component: PerfilComponent},
    
    { path: '**', redirectTo: 'Home' }
];
