import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { authGuard } from './services/Interceptor/auth.guard';


export const routes: Routes = [
    { path: '', redirectTo: 'Home', pathMatch: 'full' },
    
    { path: 'Home', component: Home },
    
    { path: 'registro', loadComponent: () => import('./pages/registrar-usuario/registrar-usuario').then(m => m.RegistrarUsuario) },

    {path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login)},

    // authGuard revisa que exista sesion y que el rol permita entrar a cada panel.
    {path: 'chofer', loadComponent: () => import('./pages/chofer/chofer').then(m => m.Chofer), canActivate: [authGuard], data: { roles: ['CHOFER','ADMIN'] }},

    {path: 'pasajero', loadComponent: () => import('./pages/pasajero/pasajero').then(m => m.PasajeroComponent), canActivate: [authGuard], data: { roles: ['PASAJERO','ADMIN'] }},

    {path: 'admin', loadComponent: () => import('./pages/admin/admin').then(m => m.AdminPage), canActivate: [authGuard], data: { roles: ['ADMIN'] }},
    
    {path: 'blogs', loadComponent: () => import('./pages/blog.component/blog.component').then(m => m.BlogComponent)},

    {path: 'nosotros', loadComponent: () => import('./pages/nosotros.component/nosotros.component').then(m => m.NosotrosComponent)},

    {path: 'perfil', loadComponent: () => import('./pages/perfil.component/perfil.component').then(m => m.PerfilComponent), canActivate: [authGuard]},
    
    { path: '**', redirectTo: 'Home' }
];
