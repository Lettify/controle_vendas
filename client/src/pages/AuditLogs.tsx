
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function AuditLogs() {
    const { setTitle } = usePageHeader();
    const [page, setPage] = useState(0);
    const [actionFilter, setActionFilter] = useState("");
    const pageSize = 20;

    useState(() => {
        setTitle("Logs de Auditoria");
    });

    const { data, isLoading } = trpc.auditLogs.list.useQuery({
        limit: pageSize,
        offset: page * pageSize,
        action: actionFilter || undefined,
    });

    const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

    return (
        <div className="container mx-auto p-6 space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Histórico de Ações</CardTitle>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Filtrar por ação..."
                            value={actionFilter}
                            onChange={(e) => {
                                setActionFilter(e.target.value);
                                setPage(0);
                            }}
                            className="w-64"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data/Hora</TableHead>
                                    <TableHead>Usuário</TableHead>
                                    <TableHead>Ação</TableHead>
                                    <TableHead>Entidade</TableHead>
                                    <TableHead>Detalhes</TableHead>
                                    <TableHead>IP</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            Carregando logs...
                                        </TableCell>
                                    </TableRow>
                                ) : data?.logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Nenhum registro encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data?.logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{log.userName || "Desconhecido"}</span>
                                                    <span className="text-xs text-muted-foreground">{log.userId}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                                    {log.action}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium">{log.entityType}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{log.entityId}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[300px] truncate" title={log.details || ""}>
                                                {log.details ? (
                                                    <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs">
                                                        {log.details}
                                                    </code>
                                                ) : (
                                                    "-"
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {log.ipAddress || "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Paginação */}
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0 || isLoading}
                        >
                            Anterior
                        </Button>
                        <div className="text-sm text-muted-foreground">
                            Página {page + 1} de {totalPages || 1}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={!data || (page + 1) >= totalPages || isLoading}
                        >
                            Próxima
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
