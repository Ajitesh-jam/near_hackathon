// this cotract is a will executor contract that will execute the will of the deceased person
// it willaccept will requests from user like on my death pay all my assets to my beneficiaries in the ratio of my splits
// the user will pay a fee to the contract to store the will

// Architecture: there is a will_store_array that will store the all the will requests
// the will_store_array will be a mapping of will_id to WillRequest
// the will_id will be a hash of the will_text
// the will_text will be a string that will be the will of the deceased person
// the executor will be the person who has creaated the will and will be dead by the time the will is executed
// the total_amount is the all assets to the Shade agent
// the beneficiary are some beneficiaries who will receive the assets in the ratio of the splits : can be 1,2,  to max 10
// the splits is an array of 10 numbers that will be used to divide the total_amount among the beneficiaries


// will make a execute_will function which will first check of the agent is registered 


use crate::*;
use serde_json::json;
use sha2::{Digest, Sha256};
use near_sdk::{near, AccountId, Promise, NearToken};

// request to store Wills
#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct WillStoreEntry {
    pub executor: AccountId,
    // pub total_amount: U128,
    pub beneficiary: [AccountId; 10],
    pub splits: [U128; 10]
}



#[near]
impl Contract {
    pub fn init(&mut self, will_request: WillStoreEntry) {
        self.will_entry = WillStoreEntry {
            executor: will_request.executor,
            // total_amount: will_request.total_amount,
            beneficiary: will_request.beneficiary,
            splits: will_request.splits
        };
    }

    pub fn add_will_beneficiary(&mut self, beneficiary: AccountId, split: U128) {
        self.will_entry.beneficiary.push(beneficiary);
        self.will_entry.splits.push(split);
    }

     // Function for the agent to call and resume the yield promise
    pub fn execute_will(&mut self) {
        self.require_approved_codehash();

        let sum_of_splits = self.will_entry.splits.iter().sum();
        for i in 0..self.will_entry.beneficiary.len() {
            let beneficiary_account = self.will_entry.beneficiary[i];
            let split = self.will_entry.splits[i];
            let amount = agent_balance() * split / sum_of_splits;
            // pay the assets to the beneficiary
            Promise::new(beneficiary_account.clone()).transfer(amount);
        }      
    }
     // Function for the agent to call and resume the yield promise
    pub fn execute_will_by_owner(&mut self) {
        self.require_owner();
        // trasnfer all the assets to the owner     
        Promise::new(self.owner_id.clone()).transfer(agent_balance());
        
        // delete the contract
        // Promise::new(self.owner_id.clone()).delete_contract();
    }

    pub fn get_will(
        &self,
    ) -> WillStoreEntry {
        self.will_entry.clone()
    }

}

fn hash(manifesto: String) -> String {
    let mut hasher = Sha256::new();
    hasher.update(manifesto);
    let hash = hasher.finalize();
    encode(hash)
}
