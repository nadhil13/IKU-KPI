import { useEffect, useState } from 'react';
import KPIDataEntrySheet from '../../kpi/components/KPIDataEntrySheet';
import { readKpiWorkflow, readUnitSubmission, reviewUnitKpi, subscribeKpiWorkflow } from '../../kpi/kpiWorkflowStore';
import { formatIndonesianNumber } from '../../kpi/kpiSchema';

const labels = { SUBMITTED: 'Dikirim unit', APPROVED: 'Disetujui', NEEDS_REVISION: 'Perlu revisi' };
export default function KPISubmissionInbox() {
  const [state, setState] = useState(readKpiWorkflow);
  const [selected, setSelected] = useState(null);
  useEffect(() => subscribeKpiWorkflow(() => setState(readKpiWorkflow())), []);
  const review = (form, unit, status) => {
    const note = status === 'NEEDS_REVISION' ? window.prompt('Catatan perbaikan untuk unit:') : '';
    if (status === 'NEEDS_REVISION' && !note?.trim()) return;
    reviewUnitKpi(form.id, unit.email, status, note?.trim());
  };
  return <div className="gov-table">
    <div className="gov-table-head"><div><h2>Submission Unit Kerja</h2><span>Formulir dan capaian tersimpan sesuai versi/periode saat dikirim.</span></div></div>
    {!state.forms.length && <p className="gov-placeholder">Belum ada distribusi. Buat formulir lalu pilih Kirim ke Unit Kerja.</p>}
    {[...state.forms].reverse().map((form) => <section key={form.id} style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
      <h3>Periode {form.period} · Form v{form.version}</h3>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left', fontSize: '.8rem', borderSpacing: '0 12px' }}>
        <thead><tr><th>Unit</th><th>Status</th><th>Skor</th><th>Capaian per bagian</th><th>Tindakan PRP</th></tr></thead>
        <tbody>{form.units.map((unit) => {
          const record = readUnitSubmission(form.id, unit.email, state);
          return <tr key={unit.email}>
            <td>{unit.name}<small style={{ display: 'block' }}>{unit.email}</small></td>
            <td>{labels[record?.status] || 'Belum submit'}{record?.revisionNote && <small style={{ display: 'block' }}>{record.revisionNote}</small>}</td>
            <td>{record ? formatIndonesianNumber(record.totalScore) : '—'}</td>
            <td>{record?.sectionScores.map((section) => `${section.code}: ${formatIndonesianNumber(section.score)}`).join(' · ') || '—'}</td>
            <td>{record && <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
              <button className="kpi-designer-button" onClick={() => setSelected({ form, record })}>Lihat isian</button>
              {record.status === 'SUBMITTED' && <>
                <button className="kpi-designer-button" onClick={() => review(form, unit, 'APPROVED')}>Setujui</button>
                <button className="kpi-designer-button" onClick={() => review(form, unit, 'NEEDS_REVISION')}>Kembalikan</button>
              </>}
            </div>}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </section>)}
    {selected && <div style={{ padding: '1rem' }}>
      <button className="kpi-designer-button" onClick={() => setSelected(null)}>Tutup detail</button>
      <h3>{selected.record.unit} · {selected.form.period} · v{selected.form.version}</h3>
      <KPIDataEntrySheet key={`${selected.form.id}:${selected.record.email}`} sectionsOverride={selected.form.sections}
        valuesOverride={selected.record.values} persist={false} readOnly />
    </div>}
  </div>;
}