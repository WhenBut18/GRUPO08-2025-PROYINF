import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Send, UploadCloud, X, FileIcon, User, Briefcase, Lock, Unlock } from "lucide-react";
import { z } from "zod";
import { useDropzone } from "react-dropzone";

const API_TRAMITACION_URL = "http://localhost:8080";

// --- Tipados ---
interface UploadedFile {
  name: string;
  size: number;
  progress: number;
  id: string;
  isUploading: boolean;
}

// ------------------------------------------------------------------
// 1. COMPONENTE HIJO: FileUploader 
// ------------------------------------------------------------------
const FileUploader = ({ 
  uploadedFiles, 
  setUploadedFiles, 
  processDocumentOCR,
  title = "Sube tus archivos",
  description = "Arrastra y suelta archivos aquí, o haz clic para seleccionar."
}: {
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  processDocumentOCR: (file: File) => Promise<void>;
  title?: string;
  description?: string;
}) => {
  
  const simulateUpload = useCallback((file: File) => {
    const fileId = crypto.randomUUID();
    //const fileId = Date.now().toString() + Math.random().toString(36).substring(2);
    const newFile: UploadedFile = { name: file.name, size: file.size, progress: 0, id: fileId, isUploading: true };
    setUploadedFiles(prev => [...prev, newFile]);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: progress } : f));
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, isUploading: false } : f)), 500);
      }
    }, 150);
  }, [setUploadedFiles]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => simulateUpload(file));
    if (acceptedFiles.length > 0) {
      await processDocumentOCR(acceptedFiles[0]);
    }
  }, [simulateUpload, processDocumentOCR]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxSize: 5242880,
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] }
  });

  const removeFile = (fileId: string) => setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${isDragActive ? "border-primary bg-primary/10" : "border-gray-300 hover:border-gray-400 bg-white dark:border-gray-700 dark:bg-gray-800"}`}>
        <input {...getInputProps()} />
        <UploadCloud className="w-8 h-8 text-primary mx-auto mb-2" />
        <p className="font-medium text-primary">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {uploadedFiles.length > 0 && (
        <ul className="space-y-2">
          {uploadedFiles.map((file) => (
            <li key={file.id} className="flex items-center justify-between p-3 border rounded-md bg-white dark:bg-gray-900">
              <div className="flex items-center space-x-3 w-full">
                <FileIcon className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  {file.isUploading && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 mt-1">
                          <div className="bg-primary h-1.5 rounded-full" style={{ width: `${file.progress}%` }}></div>
                      </div>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeFile(file.id)} className="ml-4 flex-shrink-0 w-8 h-8" disabled={file.isUploading}><X className="w-4 h-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// 2. COMPONENTE PADRE: Apply
// ------------------------------------------------------------------
const applicationSchema = z.object({
  employment_status: z.string().min(1, { message: "Selecciona tu situación laboral" }),
  monthly_income: z.number().min(1, { message: "Ingresa tu ingreso mensual" }),
});

export default function Apply() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [simulation, setSimulation] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Estados de Archivos
  const [idFrontFiles, setIdFrontFiles] = useState<UploadedFile[]>([]);
  const [idBackFiles, setIdBackFiles] = useState<UploadedFile[]>([]);
  const [docFiles, setDocFiles] = useState<UploadedFile[]>([]);
  const [backVerification, setBackVerification] = useState<any>(null);
  const [isVerifyingBack, setIsVerifyingBack] = useState(false);

  // Lógica de Desbloqueo: Si hay archivos, se puede editar.
  const canEditId = idFrontFiles.length > 0;
  const carnetVerificado = backVerification?.success && backVerification?.resultado?.verificacion_ok;
  const canSubmitId = idFrontFiles.length > 0 && idBackFiles.length > 0 && carnetVerificado;
  const canEditDocs = docFiles.length > 0;

  const [formData, setFormData] = useState({
    employment_status: "", monthly_income: "", account_number: "",
    rut: "", name: "", address: "", nationality: "", age: "",
    fecha_vencimiento: "",
    seniority: "", cmf_debt: "", assets_liabilities: "",
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    const simulationId = searchParams.get("simulation");
    if (simulationId && user) loadSimulation(simulationId);
  }, [user, authLoading, searchParams, navigate]);

  const loadSimulation = async (id: string) => {
    try {
      const response = await fetch(`${API_TRAMITACION_URL}/loan_simulations?id=${id}`);
      if (!response.ok) throw new Error("No se pudo cargar la simulación");
      setSimulation(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const processFrontDocumentOCR = useCallback(async (file: File) => {
    setIsExtracting(true);
    toast({ title: "Analizando documento delantero...", description: "Extrayendo datos automáticamente." });

    try {
      const formPayload = new FormData();
      formPayload.append('documento', file);

      const response = await fetch(`${API_TRAMITACION_URL}/extract-document`, { method: 'POST', body: formPayload });
      const result = await response.json();

      if (result.success && result.datos_extraidos) {
        const { identificador, laboral, domicilio } = result.datos_extraidos;
        setFormData(prev => ({
          ...prev,
          rut: identificador.rut || prev.rut || "",
          name: identificador.nombre_completo || prev.name || "",
          nationality: identificador.nacionalidad || prev.nationality || "",
          age: identificador.edad ? String(identificador.edad) : prev.age,
          fecha_vencimiento: identificador.fecha_vencimiento || prev.fecha_vencimiento || "",
          monthly_income: laboral.alcance_liquido ? String(laboral.alcance_liquido) : prev.monthly_income,
          address: domicilio.direccion || prev.address || "",
        }));

        toast({ title: `¡${result.tipo_documento} procesado! 🚀`, description: "Revisa y corrige los datos si es necesario.", variant: "default" });
      }
    } catch (error: any) {
      toast({ title: "Lectura manual requerida", description: error.message || "No pudimos leer todo el documento.", variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  }, [toast]);

  const processBackDocumentVerification = useCallback(async (file: File) => {
    setIsVerifyingBack(true);
    toast({ 
      title: "Verificando parte trasera...", 
      description: "Extrayendo QR y comparando con los datos delanteros." 
    });

    try {
      if (!formData.rut) {
        throw new Error("Primero debes subir la parte delantera para obtener el RUT.");
      }

      if (!formData.fecha_vencimiento) {
        throw new Error("Primero debes subir la parte delantera para obtener la fecha de vencimiento.");
      }

      const formPayload = new FormData();

      // Este nombre debe coincidir con multer en el backend.
      // Si tu backend usa upload.single('documento'), esto está bien.
      formPayload.append('documento', file);

      // Datos que vienen de la parte delantera
      formPayload.append('rutDelantero', formData.rut);
      formPayload.append('fechaVencimientoDelantera', formData.fecha_vencimiento);

      const response = await fetch(`${API_TRAMITACION_URL}/verify-carnet-back`, { 
        method: 'POST', 
        body: formPayload 
      });

      const result = await response.json();
      setBackVerification(result);

      if (!response.ok || !result.success) {
        console.log("ERROR BACKEND VERIFICACION:", result);

        throw new Error(
          result.error
            ? `${result.message}: ${result.error}`
            : result.message || "No se pudo verificar el reverso del carnet"
        );
      }

      if (result.resultado?.verificacion_ok) {
        toast({ 
          title: "✓ Carnet verificado", 
          description: "El RUT coincide, el dígito verificador es válido y el carnet no está vencido.", 
          variant: "default" 
        });
      } else {
        const errores = [];

        if (!result.resultado?.rut_coincide) {
          errores.push("el RUT no coincide con Registro Civil");
        }

        if (!result.resultado?.rut_valido) {
          errores.push("el dígito verificador del RUT no es válido");
        }

        if (result.resultado?.fecha_vencida) {
          errores.push("el carnet está vencido");
        }

        toast({ 
          title: "⚠ Verificación incompleta", 
          description: errores.join(", "), 
          variant: "destructive" 
        });
      }

    } catch (error: any) {
      setBackVerification({ success: false, error: error.message });
      toast({ 
        title: "Error de verificación", 
        description: error.message || "No se pudo procesar la imagen trasera.", 
        variant: "destructive" 
      });
    } finally {
      setIsVerifyingBack(false);
    }
    }, [formData.rut, formData.fecha_vencimiento, toast]);

  const processDocumentOCR = useCallback(async (file: File) => {
    setIsExtracting(true);
    toast({ title: "Analizando documento...", description: "Extrayendo datos automáticamente." });

    try {
      const formPayload = new FormData();
      formPayload.append('documento', file);

      const response = await fetch(`${API_TRAMITACION_URL}/extract-document`, { method: 'POST', body: formPayload });
      const result = await response.json();

      if (result.success && result.datos_extraidos) {
        const { identificador, laboral, domicilio } = result.datos_extraidos;
        setFormData(prev => ({
          ...prev,
          rut: identificador.rut || prev.rut || "",
          name: identificador.nombre_completo || prev.name || "",
          nationality: identificador.nacionalidad || prev.nationality || "",
          age: identificador.edad ? String(identificador.edad) : prev.age,
          monthly_income: laboral.alcance_liquido ? String(laboral.alcance_liquido) : prev.monthly_income,
          address: domicilio.direccion || prev.address || "",
        }));

        toast({ title: `¡${result.tipo_documento} procesado! 🚀`, description: "Revisa y corrige los datos si es necesario.", variant: "default" });
      }
    } catch (error) {
      toast({ title: "Lectura manual requerida", description: "No pudimos leer todo el documento. Se han habilitado los campos para relleno manual.", variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  }, [toast]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulation || !user) return;

    if (!canSubmitId || !canEditDocs) {
      toast({ title: "Faltan documentos", description: "Debes subir ambas caras de tu cédula y los documentos laborales requeridos.", variant: "destructive" });
      return;
    }

    const allFiles = [...idFrontFiles, ...idBackFiles, ...docFiles];
    if (allFiles.some(f => f.isUploading)) {
        toast({ title: "Archivos pendientes", description: "Espera a que los archivos terminen de subir.", variant: "destructive" });
        return;
    }

    setLoading(true);
    try {
      const monthlyIncome = parseFloat(formData.monthly_income);

      // La decisión approved/rejected/under_review la toma el backend
      // (filtros duros + modelo de scoring). Aquí solo enviamos los datos.
      const response = await fetch(`${API_TRAMITACION_URL}/loan_applications`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id, simulation_id: simulation.id, amount: simulation.amount, months: simulation.months,
          monthly_payment: simulation.monthly_payment, employment_status: formData.employment_status,
          monthly_income: monthlyIncome,
          // Variables para el modelo de scoring
          edad: formData.age ? Number(formData.age) : null,
          deuda_cmf: formData.cmf_debt ? Number(formData.cmf_debt) : null,
          notes: `RUT: ${formData.rut}. Archivos: ${allFiles.length}`,
        }),
      });

      if (!response.ok) throw new Error("Error al enviar solicitud");

      const result = await response.json();
      const finalStatus = result.status;

      if (finalStatus === "rejected") {
        toast({ title: "Solicitud Rechazada", description: "Tu solicitud no cumple los criterios de aprobación.", variant: "destructive" });
        navigate("/applications");
      } else if (finalStatus === "under_review") {
        toast({ title: "Solicitud en revisión", description: "Tu solicitud quedó en revisión manual. Te contactaremos pronto." });
        navigate("/applications");
      } else {
        toast({ title: "¡Solicitud enviada!", description: "Revisaremos tu solicitud pronto." });
        navigate("/applications");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !simulation) return <div className="min-h-screen bg-gradient-hero flex items-center justify-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 dark:bg-gray-900">
      <div className="container mx-auto px-4 max-w-5xl">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver al inicio
        </Button>

        {/* ESTRUCTURA ORIGINAL: 1/3 Izquierda, 2/3 Derecha */}
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* LADO IZQUIERDO: Resumen */}
          <div className="md:col-span-1 space-y-6">
            <Card className="shadow-sm sticky top-6">
              <CardHeader className="bg-primary/5 border-b pb-4">
                <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-primary"/> Resumen de Solicitud</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Monto Solicitado</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(simulation.amount)}</p>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <p className="text-sm text-muted-foreground">Plazo</p>
                  <p className="font-semibold">{simulation.months} meses</p>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <p className="text-sm text-muted-foreground">Cuota mensual</p>
                  <p className="font-semibold">{formatCurrency(simulation.monthly_payment)}</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-sm text-muted-foreground">Total a pagar</p>
                  <p className="font-semibold">{formatCurrency(simulation.total_payment)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LADO DERECHO: Formulario */}
          <div className="md:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* SECCIÓN 1: CÉDULA DE IDENTIDAD */}
              <Card className="shadow-sm border-blue-100 dark:border-blue-900 overflow-hidden">
                <CardHeader className="bg-blue-50/50 dark:bg-blue-900/10 border-b pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      <CardTitle className="text-xl">1. Identidad del Solicitante</CardTitle>
                    </div>
                    {!canEditId ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Unlock className="w-4 h-4 text-green-600" />}
                  </div>
                  <CardDescription>Sube tu cédula primero para habilitar y autocompletar estos campos.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rut">RUT</Label>
                      <Input id="rut" disabled={!canEditId} value={formData.rut} onChange={e => setFormData({...formData, rut: e.target.value})} placeholder="Ej: 11.111.111-1" className={!canEditId ? "bg-gray-100" : "bg-white"}/>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="name">Nombre Completo</Label>
                      <Input id="name" disabled={!canEditId} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Juan Pérez" className={!canEditId ? "bg-gray-100" : "bg-white"}/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">Edad</Label>
                      <Input id="age" disabled={!canEditId} value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} placeholder="Ej: 30" className={!canEditId ? "bg-gray-100" : "bg-white"}/>
                    </div>
                    <div className="space-y-2 md:col-span-4">
                      <Label htmlFor="nationality">Nacionalidad</Label>
                      <Input id="nationality" disabled={!canEditId} value={formData.nationality} onChange={e => setFormData({...formData, nationality: e.target.value})} placeholder="Ej: CHILENA" className={!canEditId ? "bg-gray-100" : "bg-white"}/>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="fecha_vencimiento">Fecha de Vencimiento</Label>
                      <Input id="fecha_vencimiento" disabled={!canEditId} value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} placeholder="Ej: 07/03/2030" className={!canEditId ? "bg-gray-100" : "bg-white"}/>
                    </div>
                  </div>
                  
                  <div className="grid gap-4">
                    <div className="bg-blue-50/30 p-2 rounded-lg">
                      <FileUploader 
                        uploadedFiles={idFrontFiles} setUploadedFiles={setIdFrontFiles} processDocumentOCR={processFrontDocumentOCR}
                        title="Sube la foto delantera de tu Cédula" description="Formatos: JPG, PNG, PDF. (Desbloquea los campos superiores)"
                      />
                    </div>
                    <div className="bg-blue-50/30 p-2 rounded-lg">
                      <FileUploader 
                        uploadedFiles={idBackFiles} setUploadedFiles={setIdBackFiles} processDocumentOCR={processBackDocumentVerification}
                        title="Sube la foto trasera de tu Cédula" description="Se extrae el QR y se verifica automáticamente."
                      />
                    </div>
                  </div>
                  {backVerification && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
                      <p className="font-medium">Resultado de verificación del carnet:</p>

                      {backVerification.success ? (
                        <>
                          <p>
                            QR detectado:{" "}
                            <strong className={backVerification.resultado?.qr_detectado ? "text-green-600" : "text-red-600"}>
                              {backVerification.resultado?.qr_detectado ? "✓ Sí" : "✗ No"}
                            </strong>
                          </p>
                          <p>
                            RUT delantero:{" "}
                            <strong>{backVerification.resultado?.rut_delantero}</strong>
                          </p>
                          <p>
                            RUT Registro Civil:{" "}
                            <strong>{backVerification.resultado?.rut_registro_civil}</strong>
                          </p>
                          <p>
                            RUT coincide con Registro Civil:{" "}
                            <strong className={backVerification.resultado?.rut_coincide ? "text-green-600" : "text-red-600"}>
                              {backVerification.resultado?.rut_coincide ? "✓ Sí" : "✗ No"}
                            </strong>
                          </p>
                          <p>
                            Dígito verificador del RUT:{" "}
                            <strong className={backVerification.resultado?.rut_valido ? "text-green-600" : "text-red-600"}>
                              {backVerification.resultado?.rut_valido ? "✓ Sí" : "✗ No"}
                            </strong>
                          </p>
                          <p>
                            Fecha de vencimiento:{" "}
                            <strong>{backVerification.resultado?.fecha_vencimiento}</strong>
                          </p>
                          <p>
                            Carnet vencido:{" "}
                            <strong className={backVerification.resultado?.fecha_vencida ? "text-red-600" : "text-green-600"}>
                              {backVerification.resultado?.fecha_vencida ? "✗ Sí" : "✓ No"}
                            </strong>
                          </p>
                          {backVerification.resultado?.numero_documento && (
                            <p>
                              Número de documento:{" "}
                              <strong>{backVerification.resultado.numero_documento}</strong>
                            </p>
                          )}
                          <div className="border-t pt-2 mt-2">
                            <p>
                              Verificación final:{" "}
                              <strong className={backVerification.resultado?.verificacion_ok ? "text-green-600" : "text-red-600"}>
                                {backVerification.resultado?.verificacion_ok ? "✓ Aprobada" : "✗ Rechazada"}
                              </strong>
                            </p>
                          </div>
                        </>
                      ) : (
                        <p className="text-red-600">
                          Error: {backVerification.error || backVerification.message || "No se pudo verificar el reverso del carnet."}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SECCIÓN 2: SITUACIÓN LABORAL */}
              <Card className="shadow-sm border-emerald-100 dark:border-emerald-900 overflow-hidden">
                <CardHeader className="bg-emerald-50/50 dark:bg-emerald-900/10 border-b pb-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-emerald-600" />
                    <CardTitle className="text-xl">2. Situación Laboral y Financiera</CardTitle>
                  </div>
                  <CardDescription>Selecciona tu situación para saber qué documentos subir.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  
                  <div className="space-y-2 md:w-1/2">
                    <Label htmlFor="employment" className="text-base">¿Cuál es tu situación laboral? *</Label>
                    <Select value={formData.employment_status} onValueChange={(value) => setFormData({ ...formData, employment_status: value })} required>
                      <SelectTrigger id="employment" className="h-12 text-md">
                        <SelectValue placeholder="Selecciona una opción..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employed">Empleado (Dependiente)</SelectItem>
                        <SelectItem value="self_employed">Independiente</SelectItem>
                        <SelectItem value="retired">Jubilado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* BLOQUES DINÁMICOS SEGÚN SELECCIÓN */}
                  {formData.employment_status && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-muted-foreground">Completa los campos (Se habilitan al subir tus documentos)</h4>
                        {!canEditDocs ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Unlock className="w-4 h-4 text-green-600" />}
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Ingreso Mensual (CLP) *</Label>
                          <Input disabled={!canEditDocs} type="number" placeholder="Ej: 1200000" value={formData.monthly_income} onChange={(e) => setFormData({ ...formData, monthly_income: e.target.value })} className={!canEditDocs ? "bg-gray-100" : "bg-white"} required />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Dirección del Hogar (Extraído de boleta luz/agua)</Label>
                          <Input disabled={!canEditDocs} type="text" placeholder="Calle, Número, Comuna" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={!canEditDocs ? "bg-gray-100" : "bg-white"}/>
                        </div>

                        {formData.employment_status === 'employed' && (
                          <>
                            <div className="space-y-2">
                              <Label>Antigüedad Laboral (Meses)</Label>
                              <Input disabled={!canEditDocs} type="number" placeholder="Ej: 24" value={formData.seniority} onChange={(e) => setFormData({ ...formData, seniority: e.target.value })} className={!canEditDocs ? "bg-gray-100" : "bg-white"}/>
                            </div>
                            <div className="space-y-2">
                              <Label>Deuda reportada CMF (CLP)</Label>
                              <Input disabled={!canEditDocs} type="number" placeholder="Monto adeudado" value={formData.cmf_debt} onChange={(e) => setFormData({ ...formData, cmf_debt: e.target.value })} className={!canEditDocs ? "bg-gray-100" : "bg-white"}/>
                            </div>
                          </>
                        )}

                        {(formData.employment_status === 'self_employed' || formData.employment_status === 'retired') && (
                          <div className="space-y-2 md:col-span-2">
                            <Label>Total Activos y Pasivos</Label>
                            <Input disabled={!canEditDocs} type="text" placeholder="Ej: Casa (100M) - Deuda (20M)" value={formData.assets_liabilities} onChange={(e) => setFormData({ ...formData, assets_liabilities: e.target.value })} className={!canEditDocs ? "bg-gray-100" : "bg-white"}/>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-emerald-50/30 p-2 rounded-lg border border-emerald-100">
                        <FileUploader 
                          uploadedFiles={docFiles} setUploadedFiles={setDocFiles} processDocumentOCR={processDocumentOCR}
                          title={`Sube tus Documentos de ${formData.employment_status === 'employed' ? 'Dependiente' : 'Independiente'}`}
                          description={formData.employment_status === 'employed' 
                            ? "Requerido: Liquidaciones, Contrato, Certificado CMF y Cuenta de Luz/Agua."
                            : "Requerido: Declaración de Renta/Boletas, Activos/Pasivos y Cuenta de Luz/Agua."}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button type="submit" size="lg" className="w-full h-14 text-lg" disabled={loading || isExtracting || !canSubmitId || !canEditDocs}>
                <Send className="w-5 h-5 mr-2" /> {loading ? "Procesando..." : "Finalizar y Enviar Solicitud"}
              </Button>
              {(!canEditId || !canEditDocs) && (
                <p className="text-center text-sm text-red-500 mt-2">Debes subir tu Cédula y los Documentos Laborales para poder enviar la solicitud.</p>
              )}

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}