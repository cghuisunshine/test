## Foundations: what DNA is

> DNA (deoxyribonucleic acid) is a polymer that stores long-term biological information in the order of its bases (A, T, G, C). Cells copy DNA (replication) and read it to build RNA and proteins (gene expression).

### Core terms (quick definitions)
- **Genome**: all DNA in an organism (nuclear + mitochondrial in humans).
- **Chromosome**: a long DNA molecule packaged with proteins.
- **Gene**: a DNA region whose sequence is used to produce a functional product (often a protein via RNA).
- **Allele**: a variant of a gene.
- **Genotype / phenotype**: genetic makeup vs observable traits.

## Nucleotides: the “letters” and the backbone

### What a nucleotide is
A **DNA nucleotide** has three parts:
- **Phosphate group**
- **Deoxyribose sugar** (missing an -OH at the 2′ carbon compared with RNA)
- **Nitrogenous base**: **A**, **T**, **G**, **C**

### Purines vs pyrimidines
- **Purines (two rings)**: A, G
- **Pyrimidines (one ring)**: C, T

This matters because pairing a purine with a pyrimidine keeps the helix width consistent.

## Directionality: why 5′ → 3′ matters

DNA has direction because the sugar has numbered carbons (1′, 2′, 3′, 4′, 5′).
- A strand’s **5′ end** typically has a free phosphate.
- A strand’s **3′ end** has a free **3′-OH**.

DNA polymerases add nucleotides by forming a **phosphodiester bond** between the existing strand’s **3′-OH** and the incoming nucleotide’s phosphate. Therefore new DNA is synthesized **5′ → 3′**.

## Complementarity and Chargaff’s rules (double-stranded DNA)

In a typical duplex:
- **A pairs with T**
- **G pairs with C**

So the overall composition roughly follows:
- **%A ≈ %T**
- **%G ≈ %C**

These are classic **Chargaff’s rules** and reflect base pairing in a stable duplex.

```txt
5′ - A T G C C A T - 3′
3′ - T A C G G T A - 5′
```

## What stabilizes the helix

### Hydrogen bonds vs base stacking
- Hydrogen bonds help enforce correct pairing (A–T, G–C).
- **Base stacking** (interactions between adjacent bases) is a major contributor to duplex stability.

### GC content and melting temperature (Tm)
In general, **higher GC% → higher Tm** (harder to separate strands), because GC pairs form more hydrogen bonds and often stack differently.

## DNA vs RNA (big differences)
- **Sugar**: DNA has *deoxyribose*; RNA has *ribose*.
- **Bases**: DNA uses *T*; RNA uses *U* (uracil).
- **Typical role**: DNA stores information; RNA is often intermediate or functional (mRNA, rRNA, tRNA, regulatory RNAs).
- **Stability**: RNA is generally less chemically stable than DNA.

## Reading sequences: reverse complements

DNA strands are antiparallel. When you see a sequence written 5′ → 3′, the complementary strand written 5′ → 3′ is the **reverse complement**.

Example:
```txt
Forward (5′→3′):   A T G C C A T
Complement (3′→5′): T A C G G T A
Reverse complement: A T G G C A T
```

A lot of lab work (primer design, CRISPR guides, alignments) depends on keeping orientation straight.

## The “central dogma” (with modern nuance)
- A simplified flow: **DNA → RNA → protein**.
- Many RNAs are functional without becoming proteins (e.g., rRNA, tRNA, miRNA, lncRNA).
- Cells also regulate *when*, *where*, and *how much* RNA/protein is made.

## Mini-check
1. Why is synthesis 5′ → 3′, not 3′ → 5′?
2. What is a reverse complement and when do you need it?
