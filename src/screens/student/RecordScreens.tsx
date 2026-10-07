import React from 'react';
import {
  useCertificates,
  useConsents,
  useDiscipline,
  useHealthRecords,
  useHeightWeight,
  useInfirmaryRecords,
  useTransport,
  useVaccinations,
} from '../../hooks/useStudentRecords';
import { MenuTile } from '../../menu/types';
import { RecordListScreen } from './RecordListScreen';
import { certificateRows, consentRows, disciplineRows, healthRows, heightWeightRows, infirmaryRows, transportRows, vaccinationRows } from './recordsModel';

type TileProps = { tile: MenuTile };

const year = (syear: string | null | undefined) => `School year ${syear}`;

// Every screen below ignores its tile's stored `api` and reads one fixed, JWT-checked endpoint (S9-D2).

export function HeightWeightScreen(_props: TileProps) {
  const q = useHeightWeight();
  return <RecordListScreen q={q} build={heightWeightRows} caption={year} emptyTitle={(y) => `No height & weight records for school year ${y}`} />;
}

export function VaccinationScreen(_props: TileProps) {
  const q = useVaccinations();
  return <RecordListScreen q={q} build={vaccinationRows} caption={year} emptyTitle={(y) => `No vaccination records for school year ${y}`} />;
}

/** The health endpoint has no year filter (it returns every year), so this list says "All years". */
export function HealthDetailsScreen(_props: TileProps) {
  const q = useHealthRecords();
  return <RecordListScreen q={q} build={healthRows} caption={() => 'All years'} emptyTitle={() => 'No health records'} />;
}

export function InfirmaryScreen(_props: TileProps) {
  const q = useInfirmaryRecords();
  return <RecordListScreen q={q} build={infirmaryRows} caption={year} emptyTitle={(y) => `No infirmary records for school year ${y}`} />;
}

export function ConsentScreen(_props: TileProps) {
  const q = useConsents();
  return <RecordListScreen q={q} build={consentRows} caption={year} emptyTitle={(y) => `No consents for school year ${y}`} />;
}

export function TransportScreen(_props: TileProps) {
  const q = useTransport();
  return <RecordListScreen q={q} build={transportRows} caption={year} emptyTitle={(y) => `No transport details for school year ${y}`} />;
}

export function CertificatesScreen(_props: TileProps) {
  const q = useCertificates();
  return <RecordListScreen q={q} build={certificateRows} caption={year} emptyTitle={(y) => `No certificates for school year ${y}`} />;
}

/** Student Discipline (S9c): the same sensitive-data handling as the health lists - in memory only while open, never logged or persisted. */
export function DisciplineScreen(_props: TileProps) {
  const q = useDiscipline();
  return <RecordListScreen q={q} build={disciplineRows} caption={year} emptyTitle={(y) => `No discipline records for school year ${y}`} />;
}
