use alloc::vec::Vec;
use borsh::{BorshDeserialize, BorshSchema, BorshSerialize};
use derive_more::{Deref, From, Into};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(
    Debug,
    Clone,
    From,
    Into,
    Deref,
    Serialize,
    Deserialize,
    BorshDeserialize,
    BorshSerialize,
    BorshSchema,
    JsonSchema,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
)]
pub struct QuoteBytes(Vec<u8>);
