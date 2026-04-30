 import { Smartphone, Download, CheckCircle2, AlertCircle, Apple, Store } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 
 const DownloadApp = () => {
   // Configuração: Mude para 'true' quando estiver na Play Store
   const isAvailableOnPlayStore = false;
   const playStoreUrl = "https://play.google.com/store/apps/details?id=com.itasuper.app";
   const apkDownloadUrl = "https://itasuper.com.br/downloads/itasuper.apk"; // Exemplo
 
   return (
     <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4 md:px-6">
       <div className="max-w-2xl w-full space-y-8">
         <div className="text-center space-y-2">
           <h1 className="text-4xl font-extrabold tracking-tight text-primary">Baixar ItaSuper</h1>
           <p className="text-muted-foreground text-lg">
             Tenha o melhor delivery da cidade na palma da sua mão.
           </p>
         </div>
 
         {isAvailableOnPlayStore ? (
           <Card className="border-primary/20 bg-primary/5">
             <CardHeader className="text-center">
               <div className="mx-auto bg-primary rounded-full p-3 w-fit mb-4">
                 <Store className="h-8 w-8 text-primary-foreground" />
               </div>
               <CardTitle>Disponível na Play Store</CardTitle>
               <CardDescription>Baixe agora a versão oficial e segura.</CardDescription>
             </CardHeader>
             <CardContent className="flex justify-center">
               <Button size="lg" className="w-full md:w-auto px-12 h-16 text-lg" onClick={() => window.open(playStoreUrl, "_blank")}>
                 Ir para Play Store
               </Button>
             </CardContent>
           </Card>
         ) : (
           <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
             <CardHeader className="text-center">
               <div className="mx-auto bg-amber-500 rounded-full p-3 w-fit mb-4 text-white">
                 <Download className="h-8 w-8" />
               </div>
               <CardTitle>Download Direto (Beta)</CardTitle>
               <CardDescription>
                 Nossos aplicativos estão em processo de publicação na Play Store. 
                 Enquanto isso, você pode baixar o arquivo direto abaixo.
               </CardDescription>
             </CardHeader>
             <CardContent className="flex flex-col items-center gap-4">
               <Button size="lg" className="w-full md:w-auto px-12 h-16 text-lg" variant="default" onClick={() => window.open(apkDownloadUrl, "_blank")}>
                 Baixar APK para Android
               </Button>
               <p className="text-xs text-muted-foreground flex items-center gap-1">
                 <AlertCircle className="h-3 w-3" /> Requer permissão para "Instalar apps de fontes desconhecidas"
               </p>
             </CardContent>
           </Card>
         )}
 
         <div className="space-y-6">
           <h2 className="text-2xl font-bold text-center">Como instalar?</h2>
           
           <Tabs defaultValue="android" className="w-full">
             <TabsList className="grid w-full grid-cols-2">
               <TabsTrigger value="android" className="flex items-center gap-2">
                 <Smartphone className="h-4 w-4" /> Android
               </TabsTrigger>
               <TabsTrigger value="ios" className="flex items-center gap-2">
                 <Apple className="h-4 w-4" /> iOS (iPhone)
               </TabsTrigger>
             </TabsList>
             
             <TabsContent value="android" className="mt-4">
               <Card>
                 <CardContent className="pt-6 space-y-4">
                   <div className="flex gap-3">
                     <div className="bg-primary/10 text-primary font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">1</div>
                     <p>Clique no botão de download acima para baixar o arquivo <strong>.apk</strong>.</p>
                   </div>
                   <div className="flex gap-3">
                     <div className="bg-primary/10 text-primary font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">2</div>
                     <p>Ao abrir o arquivo, seu celular pode perguntar se você confia na fonte. Vá em <strong>Configurações</strong> e ative <strong>"Permitir desta fonte"</strong>.</p>
                   </div>
                   <div className="flex gap-3">
                     <div className="bg-primary/10 text-primary font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">3</div>
                     <p>Volte e clique em <strong>Instalar</strong>. Pronto! O ItaSuper aparecerá na sua lista de aplicativos.</p>
                   </div>
                 </CardContent>
               </Card>
             </TabsContent>
 
             <TabsContent value="ios" className="mt-4">
               <Card>
                 <CardContent className="pt-6 space-y-4">
                   <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-lg flex gap-3 text-amber-800 dark:text-amber-200">
                     <AlertCircle className="h-5 w-5 shrink-0" />
                     <p className="text-sm italic">
                       A Apple não permite instalação direta de arquivos. Use o modo PWA (Web App) para ter uma experiência de aplicativo.
                     </p>
                   </div>
                   <div className="flex gap-3">
                     <div className="bg-primary/10 text-primary font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">1</div>
                     <p>Abra nosso site no <strong>Safari</strong> do seu iPhone.</p>
                   </div>
                   <div className="flex gap-3">
                     <div className="bg-primary/10 text-primary font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">2</div>
                     <p>Toque no ícone de <strong>Compartilhar</strong> (quadrado com uma seta para cima) na barra inferior.</p>
                   </div>
                   <div className="flex gap-3">
                     <div className="bg-primary/10 text-primary font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">3</div>
                     <p>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.</p>
                   </div>
                 </CardContent>
               </Card>
             </TabsContent>
           </Tabs>
         </div>
 
         <div className="text-center pt-8 border-t border-muted text-muted-foreground">
           <p className="flex items-center justify-center gap-2">
             <CheckCircle2 className="h-4 w-4 text-green-500" />
             Seguro e verificado pelo sistema de segurança do seu aparelho.
           </p>
         </div>
       </div>
     </div>
   );
 };
 
 export default DownloadApp;