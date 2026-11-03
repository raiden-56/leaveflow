import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  Card,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  type Breakpoint,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { EmptyState, ErrorState, TableSkeleton } from '../common/States';

export interface Column<T> {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Enables sorting on this column. */
  sortValue?: (row: T) => string | number;
  /** Text used by the search box (defaults to sortValue). */
  searchValue?: (row: T) => string;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  minWidth?: number;
  /** Hide the column below this breakpoint (tablet layouts). */
  hideBelow?: Breakpoint;
  /** Exclude from the default mobile card. */
  hideOnCard?: boolean;
}

interface DataTableProps<T> {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  actions?: ReactNode;
  initialSort?: { id: string; direction: 'asc' | 'desc' };
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyIcon?: ReactNode;
  /** Custom mobile card; defaults to a label/value card built from the columns. */
  mobileCard?: (row: T) => ReactNode;
  title?: ReactNode;
  /** Render without the outer card (when nested inside another card). */
  bare?: boolean;
}

/**
 * Reusable data table: search, sort, pagination, loading/empty/error states,
 * row hover animation and an automatic card layout on mobile.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  error,
  onRetry,
  searchable = true,
  searchPlaceholder = 'Search…',
  toolbar,
  actions,
  initialSort,
  pageSize = 10,
  onRowClick,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  emptyIcon,
  mobileCard,
  title,
  bare,
}: DataTableProps<T>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows ?? [];
    if (q) {
      list = list.filter((row) =>
        columns.some((c) => {
          const v = c.searchValue?.(row) ?? c.sortValue?.(row);
          return v !== undefined && String(v).toLowerCase().includes(q);
        }),
      );
    }
    const col = sort && columns.find((c) => c.id === sort.id);
    if (col?.sortValue) {
      const dir = sort!.direction === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const va = col.sortValue!(a);
        const vb = col.sortValue!(b);
        return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir;
      });
    }
    return list;
  }, [rows, search, sort, columns]);

  useEffect(() => setPage(0), [search, rows?.length]);
  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const up: Record<Breakpoint, boolean> = {
    xs: true,
    sm: useMediaQuery(theme.breakpoints.up('sm')),
    md: !isMobile,
    lg: useMediaQuery(theme.breakpoints.up('lg')),
    xl: useMediaQuery(theme.breakpoints.up('xl')),
  };
  const visibleColumns = columns.filter((c) => !c.hideBelow || up[c.hideBelow]);

  const header = (searchable || toolbar || actions || title) && (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ flex: 1, minWidth: 0 }} useFlexGap flexWrap="wrap">
        {title}
        {searchable && (
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            sx={{ minWidth: { sm: 240 }, maxWidth: { md: 320 } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }, htmlInput: { 'aria-label': 'Search table' } }}
          />
        )}
        {toolbar}
      </Stack>
      {actions && <Stack direction="row" spacing={1} flexShrink={0}>{actions}</Stack>}
    </Stack>
  );

  let body: ReactNode;
  if (error) body = <Box sx={{ px: 2, pb: 2 }}><ErrorState error={error} onRetry={onRetry} /></Box>;
  else if (loading && !rows) body = <TableSkeleton />;
  else if (filtered.length === 0) body = <EmptyState title={search ? 'No matching results' : emptyTitle} description={search ? 'Try a different search term or clear the filters.' : emptyDescription} icon={emptyIcon} />;
  else if (isMobile) {
    body = (
      <Stack spacing={1.25} sx={{ p: 1.5 }}>
        <AnimatePresence initial={false}>
          {pageRows.map((row) => (
            <motion.div key={rowKey(row)} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card
                variant="outlined"
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={{ p: 1.75, cursor: onRowClick ? 'pointer' : 'default', '&:active': { transform: onRowClick ? 'scale(0.99)' : undefined } }}
              >
                {mobileCard ? (
                  mobileCard(row)
                ) : (
                  <Stack spacing={0.9}>
                    {columns.filter((c) => !c.hideOnCard).map((c) => (
                      <Stack key={c.id} direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{c.label}</Typography>
                        <Box sx={{ textAlign: 'right', minWidth: 0 }} onClick={c.id === 'actions' ? (e) => e.stopPropagation() : undefined}>{c.render(row)}</Box>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </Stack>
    );
  } else {
    body = (
      <TableContainer>
        <Table size="medium">
          <TableHead>
            <TableRow>
              {visibleColumns.map((c) => (
                <TableCell key={c.id} align={c.align} sx={{ width: c.width, minWidth: c.minWidth, whiteSpace: 'nowrap' }} sortDirection={sort?.id === c.id ? sort.direction : false}>
                  {c.sortValue ? (
                    <TableSortLabel
                      active={sort?.id === c.id}
                      direction={sort?.id === c.id ? sort.direction : 'asc'}
                      onClick={() => setSort((s) => ({ id: c.id, direction: s?.id === c.id && s.direction === 'asc' ? 'desc' : 'asc' }))}
                    >
                      {c.label}
                    </TableSortLabel>
                  ) : (
                    c.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow
                hover
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={{ cursor: onRowClick ? 'pointer' : 'default', '&:last-child td': { borderBottom: 0 } }}
              >
                {visibleColumns.map((c) => (
                  <TableCell key={c.id} align={c.align} onClick={c.id === 'actions' ? (e) => e.stopPropagation() : undefined}>
                    {c.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  const content = (
    <>
      {header}
      {body}
      {filtered.length > rowsPerPage || rowsPerPage !== pageSize ? (
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />
      ) : null}
    </>
  );
  return bare ? <Box>{content}</Box> : <Card sx={{ overflow: 'hidden' }}>{content}</Card>;
}
