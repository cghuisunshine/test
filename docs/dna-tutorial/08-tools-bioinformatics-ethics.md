## Core lab tools for working with DNA

### PCR (polymerase chain reaction)
PCR amplifies a specific DNA region using primers.
- **Denaturation**: strands separate
- **Annealing**: primers bind
- **Extension**: polymerase copies

If annealing temperature is too low, primers can bind nonspecifically (extra bands).

#### Primer design (practical tips)
- Primers define what gets amplified.
- Watch for: strong hairpins, primer–dimer formation, and unintended matches in the genome.
- GC content and length influence melting temperature.

#### Controls
- **No-template control (NTC)**: checks contamination.
- **Positive control**: confirms reagents and cycling conditions can work.

### qPCR (real-time PCR)
qPCR tracks amplification using fluorescence.
- Used for quantification (relative or absolute).
- Requires careful normalization and controls.

### Gel electrophoresis
DNA is negatively charged, so it migrates toward the positive electrode.
- Smaller fragments move faster through the gel matrix.

### Sequencing
- **Sanger**: high-accuracy for short reads; good for single genes/plasmids.
- **NGS**: massively parallel; enables whole genomes, RNA-seq, metagenomics.

#### Sequencing confidence (intuition)
- **Coverage/depth**: more reads covering a position usually increases confidence.
- **Base quality**: lower quality means higher error probability.
- **Biases** exist (GC bias, mapping ambiguity in repeats).

### Genome editing (CRISPR overview)
CRISPR systems use a guide RNA to target a matching DNA sequence.
- A nuclease makes a cut; repair pathways then create edits.

> Where the cut is repaired by NHEJ, small indels are common; HDR can introduce precise changes when a template is provided (often less efficient).

#### Off-target and validation
- Guides can have partial matches elsewhere.
- Validate edits by sequencing and consider appropriate controls.

## Bioinformatics essentials

### Common file formats
- **FASTA**: sequences
- **FASTQ**: sequences + quality scores

### Typical workflow (high level)
- QC reads → align/assemble → call variants or quantify expression → interpret in genomic context.

### A reproducibility habit
Always record:
- reference genome build
- tool versions
- parameters
- input/output file checksums (optional but helpful)

## Ethics and society

DNA information can reveal identity, ancestry, and health risk.

### Key issues
- **Consent**: what participants agreed to (and did not agree to).
- **Privacy**: who can access data and under what safeguards.
- **Equity**: who benefits from genomics and who is excluded.
- **Editing**: somatic vs germline; therapy vs enhancement.

### A useful question set
- Who could be harmed by misuse or leakage of the data?
- What safeguards exist (technical + policy)?
- Who benefits, and who is missing from the benefits?

## Practice questions (with quick answers)

1. **Why must DNA polymerase synthesize 5′ → 3′?**
   - Because the chemistry of adding nucleotides requires a 3′-OH to attack the incoming nucleotide’s phosphate.
2. **Leading vs lagging strand?**
   - Leading is continuous toward the fork; lagging is discontinuous (Okazaki fragments).
3. **Mutation vs epigenetic change?**
   - Mutation changes sequence; epigenetic change changes gene activity without changing sequence.
4. **Why does UV raise skin cancer risk?**
   - UV can form pyrimidine dimers; misrepair or replication over damage increases mutations.
5. **Annealing temperature too low in PCR?**
   - Nonspecific primer binding → off-target amplification.
