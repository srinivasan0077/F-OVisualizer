import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box, Typography, Paper, List, ListItem, ListItemIcon, ListItemText,
  CircularProgress, Alert, Button, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { CloudUpload, InsertDriveFile, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { useData } from '../context/DataContext';
import {
  detectFileType, parseParticipantOI, parseBhavcopyFutures, parseBhavcopyOptions,
  parseCommodityBhavcopy,
} from '../utils/parsers';

export default function FileUpload({ inline = false, onDone }) {
  const { addParticipantData, addBhavcopyData, addCommodityData } = useData();
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);

  const processFile = useCallback(
    (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          const fileType = detectFileType(text);
          let parsed = null;
          let error = null;

          try {
            switch (fileType) {
              case 'participant':
                parsed = parseParticipantOI(text, file.name);
                addParticipantData(parsed);
                break;
              case 'futures':
                parsed = parseBhavcopyFutures(text, file.name);
                addBhavcopyData(parsed);
                break;
              case 'options':
                parsed = parseBhavcopyOptions(text, file.name);
                addBhavcopyData(parsed);
                break;
              case 'commodity':
                parsed = parseCommodityBhavcopy(text, file.name);
                addCommodityData(parsed);
                break;
              default:
                error = 'Unrecognised CSV format';
            }
          } catch (err) {
            error = err.message;
          }

          resolve({
            name: file.name,
            fileType,
            date: parsed?.date || '?',
            recordCount: parsed?.participants?.length || parsed?.records?.length || parsed?.totalFutures + parsed?.totalOptions || 0,
            error,
          });
        };
        reader.onerror = () => resolve({ name: file.name, error: 'Failed to read file' });
        reader.readAsText(file);
      }),
    [addParticipantData, addBhavcopyData],
  );

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setProcessing(true);
      const outcomes = [];
      for (const file of acceptedFiles) {
        const result = await processFile(file);
        outcomes.push(result);
      }
      setResults(outcomes);
      setProcessing(false);
    },
    [processFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: true,
  });

  const content = (
    <Box sx={{ p: inline ? 0 : 2 }}>
      {/* Dropzone */}
      <Box
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''}`}
        sx={{ mb: 2, minHeight: inline ? 200 : 150 }}
      >
        <input {...getInputProps()} />
        <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h6" gutterBottom>
          {isDragActive ? 'Drop files here...' : 'Drag & drop CSV files here'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Supports: Participant OI, F&amp;O Bhavcopy (Futures &amp; Options), MCX Commodity, Currency
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Click to browse &bull; Multiple files supported
        </Typography>
      </Box>

      {/* Processing indicator */}
      {processing && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <CircularProgress size={28} />
          <Typography variant="body2" sx={{ mt: 1 }}>Processing files...</Typography>
        </Box>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Paper variant="outlined" sx={{ mt: 1 }}>
          <List dense>
            {results.map((r, i) => (
              <ListItem key={i}>
                <ListItemIcon>
                  {r.error ? <ErrorIcon color="error" /> : <CheckCircle color="success" />}
                </ListItemIcon>
                <ListItemText
                  primary={r.name}
                  secondary={
                    r.error
                      ? r.error
                      : `${r.fileType} • ${r.date} • ${r.recordCount} records`
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Hint */}
      {inline && results.length === 0 && !processing && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Upload NSE F&amp;O CSV files to get started. Supported formats:{' '}
          <strong>fao_participant_oi_*.csv</strong>, <strong>fo*.csv</strong> (futures),{' '}
          <strong>op*.csv</strong> (options).
        </Alert>
      )}
    </Box>
  );

  if (inline) return content;

  return (
    <>
      <DialogTitle>Upload CSV Files</DialogTitle>
      <DialogContent>{content}</DialogContent>
      <DialogActions>
        <Button onClick={onDone}>Close</Button>
      </DialogActions>
    </>
  );
}
