## Core lab tools for working with DNA

### PCR (polymerase chain reaction)
PCR amplifies a specific DNA region using primers.
- **Denaturation**: strands separate
- **Annealing**: primers bind
- **Extension**: polymerase copies

If annealing temperature is too low, primers can bind nonspecifically (extra bands).

### Gel electrophoresis
DNA is negatively charged, so it migrates toward the positive electrode.
- Smaller fragments move faster through the gel matrix.

### Sequencing
- **Sanger**: high-accuracy for short reads; good for single genes/plasmids.
- **NGS**: massively parallel; enables whole genomes, RNA-seq, metagenomics.

### Genome editing (CRISPR overview)
CRISPR systems use a guide RNA to target a matching DNA sequence.
- A nuclease makes a cut; repair pathways then create edits.

> Where the cut is repaired by NHEJ, small indels are common; HDR can introduce precise changes when a template is provided (often less efficient).

## Bioinformatics essentials

### Common file formats
- **FASTA**: sequences
- **FASTQ**: sequences + quality scores

### Typical workflow (high level)
- QC reads → align/assemble → call variants or quantify expression → interpret in genomic context.

### A reproducibility habit
Always record:
- Reference genome build
- Tool versions
- Parameters
- Input/output file checksums (optional but helpful)

## Ethics and society

DNA information can reveal identity, ancestry, and health risk.

### Key issues
- **Consent**: what participants agreed to (and did not agree to).
- **Privacy**: who can access data and under what safeguards.
- **Equity**: who benefits from genomics and who is excluded.
- **Editing**: somatic vs germline; therapy vs enhancement.

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
